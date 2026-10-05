//! One-time move from MongoDB.
//!
//! `apps/server/src/tools/export-for-rust.ts` reads the production MongoDB without writing to it
//! and produces one JSON export. That export also holds, for every profile, the bootstrap the
//! previous server computes from the same data. Importing loads everything into an empty SQLite
//! database, then recomputes each bootstrap here and requires it to equal the expected one.

use std::collections::HashSet;

use lt_domain::model::{AttemptEvent, LearningPathSettings, Millis};
use lt_store::{
    AllowedEmail, ChildProfile, EmailStatus, Family, GardenRecord, PushSubscription, Store,
};
use serde::Deserialize;
use serde_json::Value;

use crate::bootstrap::v1_bootstrap;
use crate::ingestion::parse_instant;

pub const EXPORT_FORMAT: &str = "little-tables-export/1";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Export {
    pub format: String,
    pub families: Vec<ExportFamily>,
    #[serde(default)]
    pub legacy_profile_documents: Vec<String>,
    pub attempts: Vec<ExportAttempt>,
    pub gardens: Vec<ExportGarden>,
    pub allowed_emails: Vec<ExportEmail>,
    pub push_subscriptions: Vec<ExportSubscription>,
    pub expected_bootstraps: Vec<ExpectedBootstrap>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFamily {
    pub created_at: Millis,
    pub google_subject: String,
    pub onboarding_complete: bool,
    pub profiles: Vec<ExportProfile>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProfile {
    pub avatar_id: String,
    pub id: String,
    #[serde(default)]
    pub learning_paths: Option<LearningPathSettings>,
    pub name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportAttempt {
    pub attempt: Value,
    pub profile_id: String,
    pub received_at: Millis,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportGarden {
    pub awarded_flower_ids: Vec<String>,
    pub bloom_count: i64,
    pub catalog_version: String,
    pub created_at: Millis,
    pub flower_order: Vec<String>,
    pub introduction_seen: bool,
    pub profile_id: String,
    pub rewarded_day_keys: Vec<String>,
    pub updated_at: Millis,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportEmail {
    pub email: String,
    pub session_version: i64,
    pub status: String,
}

#[derive(Deserialize)]
pub struct ExportKeys {
    pub auth: String,
    pub p256dh: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSubscription {
    pub endpoint: String,
    #[serde(default)]
    pub expiration_time: Option<f64>,
    pub keys: ExportKeys,
    #[serde(default)]
    pub last_sent_day_key: Option<String>,
    pub locale: String,
    pub profile_id: String,
    pub timezone: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedBootstrap {
    pub bootstrap: Value,
    pub profile_id: String,
}

#[derive(Debug, Default)]
pub struct ImportReport {
    pub families: usize,
    pub profiles: usize,
    pub attempts: usize,
    pub gardens: usize,
    pub allowed_emails: usize,
    pub push_subscriptions: usize,
    /// Records whose profile no longer exists, by kind.
    pub orphans: Vec<String>,
    pub verified_bootstraps: usize,
    pub mismatches: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error("the export is not readable: {0}")]
    Format(String),
    #[error("the database is not empty; import into a new file")]
    NotEmpty,
    #[error("{0}")]
    Refused(String),
    #[error(transparent)]
    Store(#[from] lt_store::StoreError),
}

/// A stored event of the previous server: its instant is an ISO string.
pub fn decode_stored_attempt(mut value: Value) -> Result<AttemptEvent, String> {
    let event_id = value["eventId"].as_str().unwrap_or("?").to_owned();
    let answered_at = value["answeredAt"]
        .as_str()
        .and_then(parse_instant)
        .ok_or_else(|| format!("{event_id}: answeredAt is not a date"))?;
    value["answeredAt"] = answered_at.into();
    serde_json::from_value(value).map_err(|error| format!("{event_id}: {error}"))
}

/// Compares two JSON values, numbers by value, and returns the path of the first difference.
pub fn difference(actual: &Value, expected: &Value, path: &str) -> Option<String> {
    match (actual, expected) {
        (Value::Number(first), Value::Number(second)) => (first.as_f64() != second.as_f64())
            .then(|| format!("{path}: {first} instead of {second}")),
        (Value::Array(first), Value::Array(second)) => {
            if first.len() != second.len() {
                return Some(format!(
                    "{path}: {} items instead of {}",
                    first.len(),
                    second.len()
                ));
            }
            first
                .iter()
                .zip(second)
                .enumerate()
                .find_map(|(index, (first, second))| {
                    difference(first, second, &format!("{path}[{index}]"))
                })
        }
        (Value::Object(first), Value::Object(second)) => {
            let keys: HashSet<&String> = first.keys().chain(second.keys()).collect();
            let mut keys: Vec<&String> = keys.into_iter().collect();
            keys.sort();
            keys.into_iter()
                .find_map(|key| match (first.get(key), second.get(key)) {
                    (Some(first), Some(second)) => {
                        difference(first, second, &format!("{path}.{key}"))
                    }
                    (None, _) => Some(format!("{path}.{key}: missing")),
                    (_, None) => Some(format!("{path}.{key}: unexpected")),
                })
        }
        _ => (actual != expected).then(|| format!("{path}: {actual} instead of {expected}")),
    }
}

fn orphan(kind: &str, profile_id: &str, report: &mut ImportReport) {
    report.orphans.push(format!("{kind} of {profile_id}"));
}

/// Loads an export into an empty database and verifies every bootstrap.
///
/// Records of profiles that no longer exist are refused unless `allow_orphans`: the previous
/// server kept them after a child was removed, and they cannot be stored without their profile.
pub async fn import(
    store: &Store,
    export: Export,
    allow_orphans: bool,
    now: Millis,
) -> Result<ImportReport, ImportError> {
    if export.format != EXPORT_FORMAT {
        return Err(ImportError::Format(format!(
            "unknown format {}",
            export.format
        )));
    }
    if !export.legacy_profile_documents.is_empty() {
        return Err(ImportError::Refused(format!(
            "{} profile documents still use the format from before family profiles ({}); sign in once with \
             each account on the previous server, then export again",
            export.legacy_profile_documents.len(),
            export.legacy_profile_documents.join(", ")
        )));
    }
    if !store.is_empty().await? {
        return Err(ImportError::NotEmpty);
    }
    let mut report = ImportReport::default();
    let mut profiles: HashSet<String> = HashSet::new();
    for family in &export.families {
        let record = Family {
            google_subject: family.google_subject.clone(),
            onboarding_complete: family.onboarding_complete,
            profiles: family
                .profiles
                .iter()
                .map(|profile| ChildProfile {
                    avatar_id: profile.avatar_id.clone(),
                    id: profile.id.clone(),
                    learning_paths: profile.learning_paths.clone(),
                    name: profile.name.clone(),
                    reminder_minute: None,
                })
                .collect(),
        };
        store.import_family(&record, family.created_at).await?;
        report.families += 1;
        report.profiles += record.profiles.len();
        profiles.extend(record.profiles.into_iter().map(|profile| profile.id));
    }

    let mut by_profile: Vec<(String, Vec<(AttemptEvent, Millis)>)> = Vec::new();
    let mut undecodable = Vec::new();
    for exported in export.attempts {
        if !profiles.contains(&exported.profile_id) {
            orphan("attempt", &exported.profile_id, &mut report);
            continue;
        }
        match decode_stored_attempt(exported.attempt) {
            Ok(event) => match by_profile
                .iter_mut()
                .find(|(id, _)| *id == exported.profile_id)
            {
                Some((_, events)) => events.push((event, exported.received_at)),
                None => by_profile.push((exported.profile_id, vec![(event, exported.received_at)])),
            },
            Err(message) => undecodable.push(message),
        }
    }
    if !undecodable.is_empty() {
        return Err(ImportError::Refused(format!(
            "{} stored attempts cannot be read: {}",
            undecodable.len(),
            undecodable.join("; ")
        )));
    }
    for (profile_id, events) in &by_profile {
        report.attempts += store.import_attempts(profile_id, events, now).await?;
    }

    for garden in &export.gardens {
        if !profiles.contains(&garden.profile_id) {
            orphan("garden", &garden.profile_id, &mut report);
            continue;
        }
        let record = GardenRecord {
            awarded_flower_ids: garden.awarded_flower_ids.clone(),
            bloom_count: garden.bloom_count,
            catalog_version: garden.catalog_version.clone(),
            flower_order: garden.flower_order.clone(),
            introduction_seen: garden.introduction_seen,
            rewarded_day_keys: garden.rewarded_day_keys.clone(),
        };
        store
            .import_garden(
                &garden.profile_id,
                &record,
                garden.created_at,
                garden.updated_at,
            )
            .await?;
        report.gardens += 1;
    }

    for email in &export.allowed_emails {
        let status = match email.status.as_str() {
            "blocked" => EmailStatus::Blocked,
            _ => EmailStatus::Allowed,
        };
        store
            .import_email(&AllowedEmail {
                email: email.email.clone(),
                session_version: email.session_version,
                status,
            })
            .await?;
        report.allowed_emails += 1;
    }

    for subscription in export.push_subscriptions {
        if !profiles.contains(&subscription.profile_id) {
            orphan("push subscription", &subscription.profile_id, &mut report);
            continue;
        }
        store
            .upsert_push_subscription(
                &PushSubscription {
                    endpoint: subscription.endpoint,
                    expiration_time: subscription.expiration_time,
                    keys_auth: subscription.keys.auth,
                    keys_p256dh: subscription.keys.p256dh,
                    last_sent_day_key: subscription.last_sent_day_key,
                    locale: subscription.locale,
                    profile_id: subscription.profile_id,
                    reminder_minute: None,
                    timezone: subscription.timezone,
                },
                now,
            )
            .await?;
        report.push_subscriptions += 1;
    }

    if !report.orphans.is_empty() && !allow_orphans {
        return Err(ImportError::Refused(format!(
            "{} records belong to profiles that no longer exist ({}); pass --allow-orphans to leave them out",
            report.orphans.len(),
            summarize(&report.orphans)
        )));
    }

    for expected in &export.expected_bootstraps {
        if !profiles.contains(&expected.profile_id) {
            continue;
        }
        let name = expected.bootstrap["profile"]["displayName"]
            .as_str()
            .unwrap_or_default();
        let actual = v1_bootstrap(store, &expected.profile_id, name, now).await?;
        match difference(&actual, &expected.bootstrap, "") {
            None => report.verified_bootstraps += 1,
            Some(path) => report
                .mismatches
                .push(format!("{}: {path}", expected.profile_id)),
        }
    }
    let expected: HashSet<&str> = export
        .expected_bootstraps
        .iter()
        .map(|expected| expected.profile_id.as_str())
        .collect();
    let mut unverified: Vec<&String> = profiles
        .iter()
        .filter(|id| !expected.contains(id.as_str()))
        .collect();
    unverified.sort();
    report.mismatches.extend(
        unverified
            .into_iter()
            .map(|id| format!("{id}: no expected bootstrap")),
    );
    Ok(report)
}

/// Counts of identical lines, most frequent first.
fn summarize(lines: &[String]) -> String {
    let mut counts: Vec<(String, usize)> = Vec::new();
    for line in lines {
        match counts.iter_mut().find(|(seen, _)| seen == line) {
            Some((_, count)) => *count += 1,
            None => counts.push((line.clone(), 1)),
        }
    }
    counts.sort_by_key(|(_, count)| std::cmp::Reverse(*count));
    counts
        .iter()
        .map(|(line, count)| format!("{count} × {line}"))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn compares_numbers_by_value_and_reports_paths() {
        assert_eq!(
            difference(&json!({"a": [1.0]}), &json!({"a": [1]}), ""),
            None
        );
        assert_eq!(
            difference(&json!({"a": [1, 2]}), &json!({"a": [1, 3]}), ""),
            Some(".a[1]: 2 instead of 3".to_owned())
        );
        assert_eq!(
            difference(&json!({"a": 1}), &json!({}), ""),
            Some(".a: unexpected".to_owned())
        );
    }

    #[test]
    fn reads_stored_attempts() {
        let event = decode_stored_attempt(json!({
            "answerMode": "keypad", "answeredAt": "2026-07-16T03:30:00.000Z", "choices": [], "correct": true,
            "eventId": "e", "factKey": "7:8", "latencyMs": 1700, "left": 7, "operation": "multiply",
            "questionCount": 1, "right": 8, "selected": 56, "sequence": 0, "sessionId": "s"
        }))
        .unwrap();
        assert_eq!(event.answered_at, 1_784_172_600_000);
        assert!(decode_stored_attempt(json!({"eventId": "x", "answeredAt": "soon"})).is_err());
    }
}

//! Daily reminders.
//!
//! Every minute, each subscription whose local time has passed its profile's reminder time and
//! that was not reminded today gets one notification, unless the child already practised that
//! local day. Children who never finished a session are not reminded yet.

use std::time::Duration;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Timelike, Utc};
use chrono_tz::Tz;
use lt_store::{PushSubscription, Store};
use web_push_native::jwt_simple::algorithms::ES256KeyPair;
use web_push_native::p256::PublicKey;
use web_push_native::{Auth, WebPushBuilder};

/// The local calendar day and the minutes elapsed since its midnight.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LocalClock {
    pub day_key: String,
    pub minute: i64,
}

fn zone(timezone: &str) -> Tz {
    timezone
        .parse()
        .or_else(|_| Tz::from_str_insensitive(timezone))
        .unwrap_or(Tz::UTC)
}

pub fn local_clock(now: i64, timezone: &str) -> LocalClock {
    let local = DateTime::<Utc>::from_timestamp_millis(now)
        .unwrap_or_default()
        .with_timezone(&zone(timezone));
    LocalClock {
        day_key: local.format("%Y-%m-%d").to_string(),
        minute: i64::from(local.hour() * 60 + local.minute()),
    }
}

/// The UTC milliseconds `[start, end)` of a local calendar day.
pub fn local_day_bounds(day_key: &str, timezone: &str) -> Option<(i64, i64)> {
    let zone = zone(timezone);
    let date = NaiveDate::parse_from_str(day_key, "%Y-%m-%d").ok()?;
    let start_of = |date: NaiveDate| {
        zone.with_ymd_and_hms(date.year(), date.month(), date.day(), 0, 0, 0)
            .earliest()
            .or_else(|| {
                zone.with_ymd_and_hms(date.year(), date.month(), date.day(), 1, 0, 0)
                    .earliest()
            })
            .map(|instant| instant.timestamp_millis())
    };
    Some((start_of(date)?, start_of(date.succ_opt()?)?))
}

/// Whether a subscription should be reminded now.
pub fn reminder_is_due(subscription: &PushSubscription, now: i64) -> bool {
    let Some(reminder_minute) = subscription.reminder_minute else {
        return false;
    };
    let clock = local_clock(now, &subscription.timezone);
    clock.minute >= reminder_minute
        && subscription.last_sent_day_key.as_deref() != Some(&clock.day_key)
}

/// Title and body of the reminder.
pub fn reminder_copy(locale: &str) -> (&'static str, &'static str) {
    let body = match locale {
        "en" => "A tiny win will make your garden grow ♡",
        "zh-Hans" => "来做一个小小练习，让你的花园继续长大吧 ♡",
        _ => "Une petite séance fera pousser ton jardin ♡",
    };
    ("little tables.", body)
}

#[derive(Debug, thiserror::Error)]
pub enum PushError {
    #[error("the VAPID private key is invalid")]
    InvalidKey,
    #[error("the subscription is invalid: {0}")]
    InvalidSubscription(String),
    #[error("the push service answered {0}")]
    Status(u16),
    #[error("the push service could not be reached: {0}")]
    Network(String),
}

/// Sends encrypted notifications signed with the server's VAPID key.
pub struct PushSender {
    contact: String,
    http: reqwest::Client,
    key_pair: ES256KeyPair,
}

impl PushSender {
    /// `private_key` is the base64url VAPID private key the previous server used.
    pub fn new(private_key: &str, contact: &str) -> Result<Self, PushError> {
        let bytes = URL_SAFE_NO_PAD
            .decode(private_key.trim().trim_end_matches('='))
            .map_err(|_| PushError::InvalidKey)?;
        // The parser panics on any other length.
        if bytes.len() != 32 {
            return Err(PushError::InvalidKey);
        }
        let key_pair = ES256KeyPair::from_bytes(&bytes).map_err(|_| PushError::InvalidKey)?;
        Ok(Self {
            contact: contact.to_owned(),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .expect("HTTP client builds"),
            key_pair,
        })
    }

    pub async fn send(
        &self,
        subscription: &PushSubscription,
        payload: &str,
    ) -> Result<(), PushError> {
        let invalid =
            |error: &dyn std::fmt::Display| PushError::InvalidSubscription(error.to_string());
        let public = URL_SAFE_NO_PAD
            .decode(subscription.keys_p256dh.trim_end_matches('='))
            .map_err(|error| invalid(&error))?;
        let auth = URL_SAFE_NO_PAD
            .decode(subscription.keys_auth.trim_end_matches('='))
            .map_err(|error| invalid(&error))?;
        if auth.len() != 16 {
            return Err(PushError::InvalidSubscription(
                "auth secret must be 16 bytes".to_owned(),
            ));
        }
        let request = WebPushBuilder::new(
            subscription
                .endpoint
                .parse()
                .map_err(|error| invalid(&error))?,
            PublicKey::from_sec1_bytes(&public).map_err(|error| invalid(&error))?,
            Auth::clone_from_slice(&auth),
        )
        .with_valid_duration(Duration::from_secs(6 * 60 * 60))
        .with_vapid(&self.key_pair, &self.contact)
        .build(payload.as_bytes().to_vec())
        .map_err(|error| invalid(&format!("{error:?}")))?;
        let mut request = reqwest::Request::try_from(request).map_err(|error| invalid(&error))?;
        request.headers_mut().insert(
            "Urgency",
            reqwest::header::HeaderValue::from_static("normal"),
        );
        let response = self
            .http
            .execute(request)
            .await
            .map_err(|error| PushError::Network(error.to_string()))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(PushError::Status(response.status().as_u16()))
        }
    }
}

/// One pass over every subscription. Returns how many reminders were sent.
pub async fn send_due_reminders(store: &Store, sender: &PushSender, now: i64) -> usize {
    let subscriptions = match store.list_push_subscriptions().await {
        Ok(subscriptions) => subscriptions,
        Err(error) => {
            tracing::error!(%error, "reminder subscriptions could not be read");
            return 0;
        }
    };
    let mut sent = 0;
    for subscription in subscriptions {
        if !reminder_is_due(&subscription, now) {
            continue;
        }
        match deliver(store, sender, &subscription, now).await {
            Ok(true) => sent += 1,
            Ok(false) => {}
            Err(error) => tracing::warn!(%error, "daily reminder delivery failed"),
        }
    }
    sent
}

async fn deliver(
    store: &Store,
    sender: &PushSender,
    subscription: &PushSubscription,
    now: i64,
) -> Result<bool, String> {
    let clock = local_clock(now, &subscription.timezone);
    let profile = &subscription.profile_id;
    if !store
        .completed_any_session(profile)
        .await
        .map_err(|error| error.to_string())?
    {
        return Ok(false);
    }
    let (start, end) = local_day_bounds(&clock.day_key, &subscription.timezone)
        .ok_or_else(|| "local day has no bounds".to_owned())?;
    if store
        .answered_between(profile, start, end)
        .await
        .map_err(|error| error.to_string())?
    {
        store
            .mark_push_sent(&subscription.endpoint, &clock.day_key, now)
            .await
            .map_err(|error| error.to_string())?;
        return Ok(false);
    }
    let (title, body) = reminder_copy(&subscription.locale);
    let payload = serde_json::json!({
        "body": body,
        "icon": "/icons/icon-192.png",
        "tag": format!("little-tables-{}", clock.day_key),
        "title": title,
        "url": "/",
    });
    match sender.send(subscription, &payload.to_string()).await {
        Ok(()) => {
            store
                .mark_push_sent(&subscription.endpoint, &clock.day_key, now)
                .await
                .map_err(|error| error.to_string())?;
            Ok(true)
        }
        Err(PushError::Status(404 | 410)) => {
            store
                .remove_push_subscription(profile, &subscription.endpoint)
                .await
                .map_err(|error| error.to_string())?;
            Ok(false)
        }
        Err(error) => Err(error.to_string()),
    }
}

/// Runs reminders every minute until the task is dropped.
pub async fn run_reminders(store: std::sync::Arc<Store>, sender: PushSender) {
    let mut interval = tokio::time::interval(Duration::from_secs(60));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        let sent = send_due_reminders(&store, &sender, Utc::now().timestamp_millis()).await;
        if sent > 0 {
            tracing::info!(sent, "daily reminders sent");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn subscription(minute: Option<i64>, last: Option<&str>) -> PushSubscription {
        PushSubscription {
            endpoint: "https://push.example/1".to_owned(),
            expiration_time: None,
            keys_auth: String::new(),
            keys_p256dh: String::new(),
            last_sent_day_key: last.map(str::to_owned),
            locale: "fr".to_owned(),
            profile_id: "p".to_owned(),
            reminder_minute: minute,
            timezone: "Europe/Paris".to_owned(),
        }
    }

    // 2026-01-05 17:30 UTC is 18:30 in Paris.
    const EVENING: i64 = 1_767_634_200_000;

    #[test]
    fn computes_the_local_clock() {
        assert_eq!(
            local_clock(EVENING, "Europe/Paris"),
            LocalClock {
                day_key: "2026-01-05".to_owned(),
                minute: 18 * 60 + 30
            }
        );
        assert_eq!(local_clock(EVENING, "Not/AZone").minute, 17 * 60 + 30);
    }

    #[test]
    fn is_due_after_the_profile_time_once_a_day() {
        assert!(reminder_is_due(&subscription(Some(1080), None), EVENING));
        assert!(!reminder_is_due(&subscription(Some(1140), None), EVENING));
        assert!(!reminder_is_due(
            &subscription(Some(1080), Some("2026-01-05")),
            EVENING
        ));
        assert!(reminder_is_due(
            &subscription(Some(1080), Some("2026-01-04")),
            EVENING
        ));
        assert!(!reminder_is_due(&subscription(None, None), EVENING));
    }

    #[test]
    fn bounds_a_local_day_including_daylight_saving_changes() {
        let (start, end) = local_day_bounds("2026-01-05", "Europe/Paris").unwrap();
        assert_eq!(end - start, 24 * 60 * 60 * 1000);
        assert_eq!(start, 1_767_567_600_000);
        let (start, end) = local_day_bounds("2026-03-29", "Europe/Paris").unwrap();
        assert_eq!(end - start, 23 * 60 * 60 * 1000);
    }

    #[test]
    fn localises_the_copy() {
        assert_eq!(
            reminder_copy("en").1,
            "A tiny win will make your garden grow ♡"
        );
        assert_eq!(
            reminder_copy("unknown").1,
            "Une petite séance fera pousser ton jardin ♡"
        );
    }

    #[tokio::test]
    async fn rejects_a_malformed_vapid_key_and_subscription() {
        assert!(PushSender::new("nope", "mailto:a@b.c").is_err());
        let key = URL_SAFE_NO_PAD.encode([7_u8; 32]);
        let sender = PushSender::new(&key, "mailto:a@b.c").unwrap();
        let error = sender
            .send(&subscription(Some(1080), None), "{}")
            .await
            .unwrap_err();
        assert!(matches!(error, PushError::InvalidSubscription(_)));
    }

    #[tokio::test]
    async fn skips_children_who_never_finished_a_session() {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::open(&directory.path().join("db")).await.unwrap();
        let profile = store
            .ensure_family("g", "léa", Some("p"), "sprout", 0)
            .await
            .unwrap()
            .profiles[0]
            .id
            .clone();
        let mut record = subscription(Some(1080), None);
        record.profile_id = profile;
        store.upsert_push_subscription(&record, 0).await.unwrap();
        let sender = PushSender::new(&URL_SAFE_NO_PAD.encode([7_u8; 32]), "mailto:a@b.c").unwrap();
        assert_eq!(send_due_reminders(&store, &sender, EVENING).await, 0);
        assert_eq!(
            store.list_push_subscriptions().await.unwrap()[0].last_sent_day_key,
            None
        );
    }
}

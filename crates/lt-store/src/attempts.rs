//! Attempt events and the learning snapshot projected from them.
//!
//! The snapshot of a profile is always equal to reducing every stored event in
//! `(answered_at, sequence, rowid)` order. Ingestion keeps it current: events arriving after the
//! last folded one are reduced incrementally, and an event arriving out of order (another device
//! syncing late) triggers a rebuild of that profile.

use lt_domain::day_key::UtcDayKeys;
use lt_domain::engine::reduce;
use lt_domain::model::{AttemptEvent, LearningSnapshot, Millis, SessionKind};
use sqlx::{Row, Sqlite, Transaction};

use crate::{Result, Store, corrupt};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct InsertResult {
    pub accepted: Vec<String>,
    /// Event ids already stored.
    pub duplicates: Vec<String>,
    /// Events answering a question of a session that already has an answer at that position.
    pub duplicate_sequences: Vec<String>,
}

/// The fields of an event needed to derive rhythm and garden without decoding payloads.
#[derive(Clone, Debug, PartialEq)]
pub struct AttemptSummary {
    pub answered_at: Millis,
    pub day_key: String,
    pub question_count: i64,
    pub sequence: i64,
    pub session_id: String,
    pub session_kind: Option<SessionKind>,
}

/// The learning day recorded with the event, or its UTC date for older events.
pub fn day_key_of(event: &AttemptEvent) -> String {
    event.learning_day_key.clone().unwrap_or_else(|| {
        lt_domain::day_key::DayKeys::day_key(&UtcDayKeys, event.answered_at, "UTC")
    })
}

fn session_kind_text(kind: Option<SessionKind>) -> Option<&'static str> {
    kind.map(|kind| match kind {
        SessionKind::DailyWatering => "daily-watering",
        SessionKind::ExtraPractice => "extra-practice",
    })
}

type Key = (Millis, i64, i64);

async fn stored_watermark(
    transaction: &mut Transaction<'_, Sqlite>,
    profile_id: &str,
) -> Result<Option<(LearningSnapshot, Option<Key>)>> {
    let row = sqlx::query(
        "SELECT snapshot, last_answered_at, last_sequence, last_rowid FROM learning_snapshots WHERE profile_id = ?",
    )
    .bind(profile_id)
    .fetch_optional(&mut **transaction)
    .await?;
    let Some(row) = row else { return Ok(None) };
    let snapshot: LearningSnapshot =
        serde_json::from_str(&row.try_get::<String, _>("snapshot")?).map_err(corrupt)?;
    let key = match (
        row.try_get::<Option<i64>, _>("last_answered_at")?,
        row.try_get::<Option<i64>, _>("last_sequence")?,
        row.try_get::<Option<i64>, _>("last_rowid")?,
    ) {
        (Some(answered_at), Some(sequence), Some(rowid)) => Some((answered_at, sequence, rowid)),
        _ => None,
    };
    Ok(Some((snapshot, key)))
}

async fn events_after(
    transaction: &mut Transaction<'_, Sqlite>,
    profile_id: &str,
    after: Option<Key>,
) -> Result<Vec<(Key, AttemptEvent)>> {
    let (answered_at, sequence, rowid) = after.unwrap_or((i64::MIN, i64::MIN, i64::MIN));
    let rows = sqlx::query(
        "SELECT rowid, answered_at, sequence, payload FROM attempt_events
         WHERE profile_id = ? AND (answered_at, sequence, rowid) > (?, ?, ?)
         ORDER BY answered_at, sequence, rowid",
    )
    .bind(profile_id)
    .bind(answered_at)
    .bind(sequence)
    .bind(rowid)
    .fetch_all(&mut **transaction)
    .await?;
    rows.iter()
        .map(|row| {
            let key = (
                row.try_get("answered_at")?,
                row.try_get("sequence")?,
                row.try_get("rowid")?,
            );
            let event: AttemptEvent =
                serde_json::from_str(&row.try_get::<String, _>("payload")?).map_err(corrupt)?;
            Ok((key, event))
        })
        .collect()
}

async fn save_snapshot(
    transaction: &mut Transaction<'_, Sqlite>,
    profile_id: &str,
    snapshot: &LearningSnapshot,
    key: Option<Key>,
    now: Millis,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO learning_snapshots (profile_id, algorithm_version, snapshot, last_answered_at, last_sequence, last_rowid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (profile_id) DO UPDATE SET algorithm_version = excluded.algorithm_version,
           snapshot = excluded.snapshot, last_answered_at = excluded.last_answered_at,
           last_sequence = excluded.last_sequence, last_rowid = excluded.last_rowid, updated_at = excluded.updated_at",
    )
    .bind(profile_id)
    .bind(&snapshot.algorithm_version)
    .bind(serde_json::to_string(snapshot).map_err(corrupt)?)
    .bind(key.map(|key| key.0))
    .bind(key.map(|key| key.1))
    .bind(key.map(|key| key.2))
    .bind(now)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

/// Brings the profile's snapshot up to date with every stored event.
async fn refresh_snapshot(
    transaction: &mut Transaction<'_, Sqlite>,
    profile_id: &str,
    earliest_new: Option<Key>,
    now: Millis,
) -> Result<LearningSnapshot> {
    let stored = stored_watermark(transaction, profile_id).await?;
    let (base, after) = match stored {
        // Every new event sorts after the folded ones: continue from the stored snapshot.
        Some((snapshot, Some(watermark))) if earliest_new.is_none_or(|key| key > watermark) => {
            (snapshot, Some(watermark))
        }
        _ => (LearningSnapshot::default(), None),
    };
    let events = events_after(transaction, profile_id, after).await?;
    if events.is_empty() && after.is_some() {
        return Ok(base);
    }
    let attempts: Vec<AttemptEvent> = events.iter().map(|(_, event)| event.clone()).collect();
    let snapshot = reduce(&base, &attempts, "UTC", &UtcDayKeys);
    let key = events.last().map(|(key, _)| *key).or(after);
    save_snapshot(transaction, profile_id, &snapshot, key, now).await?;
    Ok(snapshot)
}

impl Store {
    /// Stores new events and updates the profile's learning snapshot in the same transaction.
    pub async fn insert_attempts(
        &self,
        profile_id: &str,
        events: &[AttemptEvent],
        now: Millis,
    ) -> Result<InsertResult> {
        let mut result = InsertResult::default();
        if events.is_empty() {
            return Ok(result);
        }
        let (_guard, mut transaction) = self.write().await?;
        let mut earliest: Option<Key> = None;
        for event in events {
            let existing: Option<String> =
                sqlx::query_scalar("SELECT event_id FROM attempt_events WHERE event_id = ?")
                    .bind(&event.event_id)
                    .fetch_optional(&mut *transaction)
                    .await?;
            if existing.is_some() {
                result.duplicates.push(event.event_id.clone());
                continue;
            }
            let taken: Option<String> = sqlx::query_scalar(
                "SELECT event_id FROM attempt_events WHERE profile_id = ? AND session_id = ? AND sequence = ?",
            )
            .bind(profile_id)
            .bind(&event.session_id)
            .bind(event.sequence)
            .fetch_optional(&mut *transaction)
            .await?;
            if taken.is_some() {
                result.duplicate_sequences.push(event.event_id.clone());
                continue;
            }
            let inserted = sqlx::query(
                "INSERT INTO attempt_events (event_id, profile_id, session_id, sequence, question_count, session_kind,
                   answered_at, day_key, fact_key, correct, payload, received_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&event.event_id)
            .bind(profile_id)
            .bind(&event.session_id)
            .bind(event.sequence)
            .bind(event.question_count)
            .bind(session_kind_text(event.session_kind))
            .bind(event.answered_at)
            .bind(day_key_of(event))
            .bind(&event.fact_key)
            .bind(event.correct)
            .bind(serde_json::to_string(event).map_err(corrupt)?)
            .bind(now)
            .execute(&mut *transaction)
            .await?;
            let key = (
                event.answered_at,
                event.sequence,
                inserted.last_insert_rowid(),
            );
            earliest = Some(earliest.map_or(key, |current| current.min(key)));
            result.accepted.push(event.event_id.clone());
        }
        if earliest.is_some() {
            refresh_snapshot(&mut transaction, profile_id, earliest, now).await?;
        }
        transaction.commit().await?;
        Ok(result)
    }

    /// Imports events exactly as stored by the previous server, without validation, then
    /// rebuilds the profile's snapshot. Used once when moving from MongoDB.
    pub async fn import_attempts(
        &self,
        profile_id: &str,
        events: &[(AttemptEvent, Millis)],
        now: Millis,
    ) -> Result<usize> {
        let (_guard, mut transaction) = self.write().await?;
        let mut imported = 0;
        for (event, received_at) in events {
            let inserted = sqlx::query(
                "INSERT INTO attempt_events (event_id, profile_id, session_id, sequence, question_count, session_kind,
                   answered_at, day_key, fact_key, correct, payload, received_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (event_id) DO NOTHING",
            )
            .bind(&event.event_id)
            .bind(profile_id)
            .bind(&event.session_id)
            .bind(event.sequence)
            .bind(event.question_count)
            .bind(session_kind_text(event.session_kind))
            .bind(event.answered_at)
            .bind(day_key_of(event))
            .bind(&event.fact_key)
            .bind(event.correct)
            .bind(serde_json::to_string(event).map_err(corrupt)?)
            .bind(received_at)
            .execute(&mut *transaction)
            .await?;
            imported += inserted.rows_affected() as usize;
        }
        sqlx::query("DELETE FROM learning_snapshots WHERE profile_id = ?")
            .bind(profile_id)
            .execute(&mut *transaction)
            .await?;
        refresh_snapshot(&mut transaction, profile_id, None, now).await?;
        transaction.commit().await?;
        Ok(imported)
    }

    /// The profile's current learning snapshot.
    pub async fn snapshot(&self, profile_id: &str, now: Millis) -> Result<LearningSnapshot> {
        let row: Option<String> =
            sqlx::query_scalar("SELECT snapshot FROM learning_snapshots WHERE profile_id = ?")
                .bind(profile_id)
                .fetch_optional(self.pool())
                .await?;
        match row {
            Some(json) => serde_json::from_str(&json).map_err(corrupt),
            None => {
                let (_guard, mut transaction) = self.write().await?;
                let snapshot = refresh_snapshot(&mut transaction, profile_id, None, now).await?;
                transaction.commit().await?;
                Ok(snapshot)
            }
        }
    }

    /// Recomputes every profile's snapshot from its events. Returns the number of profiles.
    pub async fn rebuild_snapshots(&self, now: Millis) -> Result<usize> {
        let profiles: Vec<String> = sqlx::query_scalar("SELECT id FROM profiles")
            .fetch_all(self.pool())
            .await?;
        for profile_id in &profiles {
            let (_guard, mut transaction) = self.write().await?;
            sqlx::query("DELETE FROM learning_snapshots WHERE profile_id = ?")
                .bind(profile_id)
                .execute(&mut *transaction)
                .await?;
            refresh_snapshot(&mut transaction, profile_id, None, now).await?;
            transaction.commit().await?;
        }
        Ok(profiles.len())
    }

    /// Every event of the profile in learning order.
    pub async fn list_attempts(&self, profile_id: &str) -> Result<Vec<AttemptEvent>> {
        let rows: Vec<String> = sqlx::query_scalar(
            "SELECT payload FROM attempt_events WHERE profile_id = ? ORDER BY answered_at, sequence, rowid",
        )
        .bind(profile_id)
        .fetch_all(self.pool())
        .await?;
        rows.iter()
            .map(|json| serde_json::from_str(json).map_err(corrupt))
            .collect()
    }

    /// Every event of the profile answered in `[from, to)`.
    pub async fn attempts_between(
        &self,
        profile_id: &str,
        from: Millis,
        to: Millis,
    ) -> Result<Vec<AttemptEvent>> {
        let rows: Vec<String> = sqlx::query_scalar(
            "SELECT payload FROM attempt_events WHERE profile_id = ? AND answered_at >= ? AND answered_at < ?
             ORDER BY answered_at, sequence, rowid",
        )
        .bind(profile_id)
        .bind(from)
        .bind(to)
        .fetch_all(self.pool())
        .await?;
        rows.iter()
            .map(|json| serde_json::from_str(json).map_err(corrupt))
            .collect()
    }

    pub async fn attempt_summaries(&self, profile_id: &str) -> Result<Vec<AttemptSummary>> {
        let rows = sqlx::query(
            "SELECT answered_at, day_key, question_count, sequence, session_id, session_kind FROM attempt_events
             WHERE profile_id = ? ORDER BY answered_at, sequence, rowid",
        )
        .bind(profile_id)
        .fetch_all(self.pool())
        .await?;
        rows.iter()
            .map(|row| {
                let kind: Option<String> = row.try_get("session_kind")?;
                Ok(AttemptSummary {
                    answered_at: row.try_get("answered_at")?,
                    day_key: row.try_get("day_key")?,
                    question_count: row.try_get("question_count")?,
                    sequence: row.try_get("sequence")?,
                    session_id: row.try_get("session_id")?,
                    session_kind: match kind.as_deref() {
                        Some("daily-watering") => Some(SessionKind::DailyWatering),
                        Some("extra-practice") => Some(SessionKind::ExtraPractice),
                        _ => None,
                    },
                })
            })
            .collect()
    }

    /// Whether the profile answered anything in `[from, to)`.
    pub async fn answered_between(
        &self,
        profile_id: &str,
        from: Millis,
        to: Millis,
    ) -> Result<bool> {
        let found: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM attempt_events WHERE profile_id = ? AND answered_at >= ? AND answered_at < ? LIMIT 1",
        )
        .bind(profile_id)
        .bind(from)
        .bind(to)
        .fetch_optional(self.pool())
        .await?;
        Ok(found.is_some())
    }

    /// Whether the profile ever completed a session (answered its last question).
    pub async fn completed_any_session(&self, profile_id: &str) -> Result<bool> {
        let found: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM attempt_events WHERE profile_id = ? AND sequence = question_count - 1 LIMIT 1",
        )
        .bind(profile_id)
        .fetch_optional(self.pool())
        .await?;
        Ok(found.is_some())
    }
}

#[cfg(test)]
mod tests {
    use lt_domain::model::{AnswerMode, QuestionOperation};

    use super::*;
    use crate::testing::store;

    fn event(
        id: &str,
        session: &str,
        sequence: i64,
        answered_at: Millis,
        fact: (i64, i64),
        correct: bool,
    ) -> AttemptEvent {
        AttemptEvent {
            answer_mode: AnswerMode::Choice,
            answered_at,
            choices: vec![fact.0 * fact.1, 1, 2, 3],
            correct,
            event_id: id.to_owned(),
            exercise: None,
            fact_key: format!("{}:{}", fact.0.min(fact.1), fact.0.max(fact.1)),
            latency_ms: 2_000.0,
            learning_day_key: None,
            left: fact.0,
            operation: Some(QuestionOperation::Multiply),
            response: None,
            right: fact.1,
            question_count: 5,
            selected: if correct { fact.0 * fact.1 } else { 1 },
            sequence,
            session_id: session.to_owned(),
            session_kind: Some(SessionKind::DailyWatering),
            algorithm_version: None,
        }
    }

    async fn profile(store: &Store) -> String {
        store
            .ensure_family("g", "léa", None, "sprout", 0)
            .await
            .unwrap()
            .profiles[0]
            .id
            .clone()
    }

    fn reduced(events: &[AttemptEvent]) -> LearningSnapshot {
        let mut sorted = events.to_vec();
        sorted.sort_by_key(|event| (event.answered_at, event.sequence));
        reduce(&LearningSnapshot::default(), &sorted, "UTC", &UtcDayKeys)
    }

    #[tokio::test]
    async fn reports_duplicates_and_taken_positions() {
        let (store, _directory) = store().await;
        let profile = profile(&store).await;
        let first = event("a", "s", 0, 1_000, (2, 3), true);
        let result = store
            .insert_attempts(&profile, std::slice::from_ref(&first), 1)
            .await
            .unwrap();
        assert_eq!(result.accepted, ["a"]);
        let mut same_position = event("b", "s", 0, 2_000, (2, 4), true);
        same_position.session_id = "s".to_owned();
        let result = store
            .insert_attempts(&profile, &[first, same_position], 2)
            .await
            .unwrap();
        assert_eq!(result.duplicates, ["a"]);
        assert_eq!(result.duplicate_sequences, ["b"]);
    }

    #[tokio::test]
    async fn keeps_the_projection_equal_to_a_full_reduction_even_out_of_order() {
        let (store, _directory) = store().await;
        let profile = profile(&store).await;
        let day = 86_400_000;
        let late = vec![
            event("c", "s2", 0, 3 * day, (2, 3), true),
            event("d", "s2", 1, 3 * day + 5, (3, 3), false),
        ];
        let early = vec![
            event("a", "s1", 0, day, (2, 3), true),
            event("b", "s1", 1, day + 5, (3, 3), true),
        ];
        store.insert_attempts(&profile, &late, 1).await.unwrap();
        // Another device syncs older answers afterwards.
        store.insert_attempts(&profile, &early, 2).await.unwrap();
        let all: Vec<AttemptEvent> = early.iter().chain(late.iter()).cloned().collect();
        assert_eq!(store.snapshot(&profile, 3).await.unwrap(), reduced(&all));
        // In-order events continue incrementally.
        let next = vec![event("e", "s3", 0, 5 * day, (2, 3), true)];
        store.insert_attempts(&profile, &next, 4).await.unwrap();
        let all: Vec<AttemptEvent> = all.into_iter().chain(next).collect();
        assert_eq!(store.snapshot(&profile, 5).await.unwrap(), reduced(&all));
        assert_eq!(store.rebuild_snapshots(6).await.unwrap(), 1);
        assert_eq!(store.snapshot(&profile, 7).await.unwrap(), reduced(&all));
    }

    #[tokio::test]
    async fn summarises_and_answers_day_questions() {
        let (store, _directory) = store().await;
        let profile = profile(&store).await;
        let mut last = event("a", "s", 4, 10_000, (2, 3), true);
        last.learning_day_key = Some("2026-01-05".to_owned());
        store.insert_attempts(&profile, &[last], 1).await.unwrap();
        let summaries = store.attempt_summaries(&profile).await.unwrap();
        assert_eq!(summaries[0].day_key, "2026-01-05");
        assert!(store.completed_any_session(&profile).await.unwrap());
        assert!(store.answered_between(&profile, 0, 20_000).await.unwrap());
        assert!(
            !store
                .answered_between(&profile, 20_000, 30_000)
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn removing_a_child_removes_its_events() {
        let (store, _directory) = store().await;
        let first = profile(&store).await;
        let second = store.add_child("g", "Zoé", "fenna-fox", 1).await.unwrap();
        store
            .insert_attempts(&second.id, &[event("z", "s", 0, 1, (2, 2), true)], 2)
            .await
            .unwrap();
        store.remove_child("g", &second.id).await.unwrap();
        assert!(store.list_attempts(&second.id).await.unwrap().is_empty());
        assert!(store.list_attempts(&first).await.unwrap().is_empty());
    }
}

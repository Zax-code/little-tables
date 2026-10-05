//! Access list and push subscriptions.

use lt_domain::model::Millis;
use sqlx::Row;

use crate::{Result, Store};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EmailStatus {
    Allowed,
    Blocked,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AllowedEmail {
    pub email: String,
    pub session_version: i64,
    pub status: EmailStatus,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PushSubscription {
    pub endpoint: String,
    pub expiration_time: Option<f64>,
    pub keys_auth: String,
    pub keys_p256dh: String,
    pub last_sent_day_key: Option<String>,
    pub locale: String,
    pub profile_id: String,
    /// The profile's reminder time, in minutes after local midnight; `None` when switched off.
    pub reminder_minute: Option<i64>,
    pub timezone: String,
}

impl Store {
    pub async fn find_email(&self, email: &str) -> Result<Option<AllowedEmail>> {
        let row = sqlx::query(
            "SELECT email, status, session_version FROM allowed_emails WHERE email = ?",
        )
        .bind(email)
        .fetch_optional(self.pool())
        .await?;
        row.map(|row| {
            let status: String = row.try_get("status")?;
            Ok(AllowedEmail {
                email: row.try_get("email")?,
                session_version: row.try_get("session_version")?,
                status: if status == "blocked" {
                    EmailStatus::Blocked
                } else {
                    EmailStatus::Allowed
                },
            })
        })
        .transpose()
    }

    /// Emails with the given status, sorted.
    pub async fn list_emails(&self, status: EmailStatus) -> Result<Vec<String>> {
        Ok(
            sqlx::query_scalar("SELECT email FROM allowed_emails WHERE status = ? ORDER BY email")
                .bind(match status {
                    EmailStatus::Allowed => "allowed",
                    EmailStatus::Blocked => "blocked",
                })
                .fetch_all(self.pool())
                .await?,
        )
    }

    /// Allows an email. True when it was unknown or blocked before.
    pub async fn allow_email(&self, email: &str, by: &str, now: Millis) -> Result<bool> {
        let (_guard, mut transaction) = self.write().await?;
        let previous: Option<String> =
            sqlx::query_scalar("SELECT status FROM allowed_emails WHERE email = ?")
                .bind(email)
                .fetch_optional(&mut *transaction)
                .await?;
        sqlx::query(
            "INSERT INTO allowed_emails (email, status, added_at, added_by) VALUES (?, 'allowed', ?, ?)
             ON CONFLICT (email) DO UPDATE SET status = 'allowed', added_at = excluded.added_at, added_by = excluded.added_by",
        )
        .bind(email)
        .bind(now)
        .bind(by)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(previous.is_none_or(|status| status == "blocked"))
    }

    /// Blocks an email and invalidates its sessions.
    pub async fn block_email(&self, email: &str, by: &str, now: Millis) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query(
            "INSERT INTO allowed_emails (email, status, session_version, removed_at, removed_by) VALUES (?, 'blocked', 1, ?, ?)
             ON CONFLICT (email) DO UPDATE SET status = 'blocked', session_version = session_version + 1,
               removed_at = excluded.removed_at, removed_by = excluded.removed_by",
        )
        .bind(email)
        .bind(now)
        .bind(by)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    /// Imports an access record exactly as the previous server stored it.
    pub async fn import_email(&self, record: &AllowedEmail) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query(
            "INSERT INTO allowed_emails (email, status, session_version) VALUES (?, ?, ?)
             ON CONFLICT (email) DO UPDATE SET status = excluded.status, session_version = excluded.session_version",
        )
        .bind(&record.email)
        .bind(match record.status {
            EmailStatus::Allowed => "allowed",
            EmailStatus::Blocked => "blocked",
        })
        .bind(record.session_version)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn upsert_push_subscription(
        &self,
        subscription: &PushSubscription,
        now: Millis,
    ) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query(
            "INSERT INTO push_subscriptions (endpoint, profile_id, keys_auth, keys_p256dh, expiration_time, locale,
               timezone, last_sent_day_key, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (endpoint) DO UPDATE SET profile_id = excluded.profile_id, keys_auth = excluded.keys_auth,
               keys_p256dh = excluded.keys_p256dh, expiration_time = excluded.expiration_time,
               locale = excluded.locale, timezone = excluded.timezone, updated_at = excluded.updated_at",
        )
        .bind(&subscription.endpoint)
        .bind(&subscription.profile_id)
        .bind(&subscription.keys_auth)
        .bind(&subscription.keys_p256dh)
        .bind(subscription.expiration_time)
        .bind(&subscription.locale)
        .bind(&subscription.timezone)
        .bind(&subscription.last_sent_day_key)
        .bind(now)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn remove_push_subscription(&self, profile_id: &str, endpoint: &str) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query("DELETE FROM push_subscriptions WHERE endpoint = ? AND profile_id = ?")
            .bind(endpoint)
            .bind(profile_id)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(())
    }

    /// Every subscription with its profile's reminder time.
    pub async fn list_push_subscriptions(&self) -> Result<Vec<PushSubscription>> {
        let rows = sqlx::query(
            "SELECT s.endpoint, s.profile_id, s.keys_auth, s.keys_p256dh, s.expiration_time, s.locale, s.timezone,
               s.last_sent_day_key, p.reminder_minute
             FROM push_subscriptions s JOIN profiles p ON p.id = s.profile_id",
        )
        .fetch_all(self.pool())
        .await?;
        rows.iter()
            .map(|row| {
                Ok(PushSubscription {
                    endpoint: row.try_get("endpoint")?,
                    expiration_time: row.try_get("expiration_time")?,
                    keys_auth: row.try_get("keys_auth")?,
                    keys_p256dh: row.try_get("keys_p256dh")?,
                    last_sent_day_key: row.try_get("last_sent_day_key")?,
                    locale: row.try_get("locale")?,
                    profile_id: row.try_get("profile_id")?,
                    reminder_minute: row.try_get("reminder_minute")?,
                    timezone: row.try_get("timezone")?,
                })
            })
            .collect()
    }

    pub async fn has_push_subscription(&self, profile_id: &str) -> Result<bool> {
        let found: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM push_subscriptions WHERE profile_id = ? LIMIT 1")
                .bind(profile_id)
                .fetch_optional(self.pool())
                .await?;
        Ok(found.is_some())
    }

    pub async fn mark_push_sent(&self, endpoint: &str, day_key: &str, now: Millis) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query("UPDATE push_subscriptions SET last_sent_day_key = ?, updated_at = ? WHERE endpoint = ?")
            .bind(day_key)
            .bind(now)
            .bind(endpoint)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(())
    }

    /// The family's parent code hash and salt, with its failure counter and lock deadline.
    pub async fn parent_lock(
        &self,
        google_subject: &str,
    ) -> Result<Option<(String, String, i64, Option<Millis>)>> {
        let row = sqlx::query(
            "SELECT pin_hash, pin_salt, failed_attempts, locked_until FROM parent_locks WHERE family_subject = ?",
        )
        .bind(google_subject)
        .fetch_optional(self.pool())
        .await?;
        row.map(|row| {
            Ok((
                row.try_get("pin_hash")?,
                row.try_get("pin_salt")?,
                row.try_get("failed_attempts")?,
                row.try_get("locked_until")?,
            ))
        })
        .transpose()
    }

    pub async fn set_parent_lock(
        &self,
        google_subject: &str,
        pin_hash: &str,
        pin_salt: &str,
        now: Millis,
    ) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query(
            "INSERT INTO parent_locks (family_subject, pin_hash, pin_salt, failed_attempts, locked_until, updated_at)
             VALUES (?, ?, ?, 0, NULL, ?)
             ON CONFLICT (family_subject) DO UPDATE SET pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt,
               failed_attempts = 0, locked_until = NULL, updated_at = excluded.updated_at",
        )
        .bind(google_subject)
        .bind(pin_hash)
        .bind(pin_salt)
        .bind(now)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    /// Records a failed attempt; after `limit` failures the code locks until `lock_until`.
    pub async fn record_parent_lock_failure(
        &self,
        google_subject: &str,
        limit: i64,
        lock_until: Millis,
        now: Millis,
    ) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query(
            "UPDATE parent_locks SET failed_attempts = failed_attempts + 1,
               locked_until = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE locked_until END, updated_at = ?
             WHERE family_subject = ?",
        )
        .bind(limit)
        .bind(lock_until)
        .bind(now)
        .bind(google_subject)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn reset_parent_lock_failures(
        &self,
        google_subject: &str,
        now: Millis,
    ) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query("UPDATE parent_locks SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE family_subject = ?")
            .bind(now)
            .bind(google_subject)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(())
    }

    pub async fn clear_parent_lock(&self, google_subject: &str) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query("DELETE FROM parent_locks WHERE family_subject = ?")
            .bind(google_subject)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::store;

    #[tokio::test]
    async fn blocking_bumps_the_session_version_and_allowing_reports_novelty() {
        let (store, _directory) = store().await;
        assert!(store.allow_email("a@b.c", "admin", 1).await.unwrap());
        assert!(!store.allow_email("a@b.c", "admin", 2).await.unwrap());
        store.block_email("a@b.c", "admin", 3).await.unwrap();
        let record = store.find_email("a@b.c").await.unwrap().unwrap();
        assert_eq!(record.status, EmailStatus::Blocked);
        assert_eq!(record.session_version, 1);
        assert!(store.allow_email("a@b.c", "admin", 4).await.unwrap());
        assert_eq!(
            store.list_emails(EmailStatus::Allowed).await.unwrap(),
            ["a@b.c"]
        );
    }

    #[tokio::test]
    async fn subscriptions_carry_the_profile_reminder_time() {
        let (store, _directory) = store().await;
        let profile = store
            .ensure_family("g", "léa", None, "sprout", 0)
            .await
            .unwrap()
            .profiles[0]
            .id
            .clone();
        let subscription = PushSubscription {
            endpoint: "https://push.example/1".to_owned(),
            expiration_time: None,
            keys_auth: "auth".to_owned(),
            keys_p256dh: "key".to_owned(),
            last_sent_day_key: None,
            locale: "fr".to_owned(),
            profile_id: profile.clone(),
            reminder_minute: None,
            timezone: "Europe/Paris".to_owned(),
        };
        store
            .upsert_push_subscription(&subscription, 1)
            .await
            .unwrap();
        store
            .mark_push_sent(&subscription.endpoint, "2026-01-05", 2)
            .await
            .unwrap();
        let listed = store.list_push_subscriptions().await.unwrap();
        assert_eq!(listed[0].reminder_minute, Some(1080));
        assert_eq!(listed[0].last_sent_day_key.as_deref(), Some("2026-01-05"));
        store
            .remove_push_subscription(&profile, &subscription.endpoint)
            .await
            .unwrap();
        assert!(!store.has_push_subscription(&profile).await.unwrap());
    }

    #[tokio::test]
    async fn parent_lock_counts_failures_and_locks() {
        let (store, _directory) = store().await;
        store
            .ensure_family("g", "léa", None, "sprout", 0)
            .await
            .unwrap();
        store.set_parent_lock("g", "hash", "salt", 1).await.unwrap();
        for _ in 0..5 {
            store
                .record_parent_lock_failure("g", 5, 900, 2)
                .await
                .unwrap();
        }
        let (_, _, failures, locked_until) = store.parent_lock("g").await.unwrap().unwrap();
        assert_eq!((failures, locked_until), (5, Some(900)));
        store.reset_parent_lock_failures("g", 3).await.unwrap();
        assert_eq!(store.parent_lock("g").await.unwrap().unwrap().2, 0);
    }
}

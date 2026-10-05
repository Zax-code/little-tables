//! The family's parent code: its Argon2id hash, the salt devices use for their offline copy, and
//! the count of wrong attempts that locks it for a while.

use lt_domain::model::Millis;
use sqlx::Row;

use crate::{Result, Store};

#[derive(Clone, Debug, PartialEq)]
pub struct ParentLock {
    pub failed_attempts: i64,
    pub locked_until: Option<Millis>,
    pub pin_hash: String,
    pub pin_salt: String,
}

impl ParentLock {
    /// Whether wrong attempts keep the code closed at `now`.
    pub fn is_locked(&self, now: Millis) -> bool {
        self.locked_until.is_some_and(|until| until > now)
    }
}

impl Store {
    pub async fn parent_lock(&self, google_subject: &str) -> Result<Option<ParentLock>> {
        let row = sqlx::query(
            "SELECT pin_hash, pin_salt, failed_attempts, locked_until
             FROM parent_locks WHERE family_subject = ?",
        )
        .bind(google_subject)
        .fetch_optional(self.pool())
        .await?;
        row.map(|row| {
            Ok(ParentLock {
                failed_attempts: row.try_get("failed_attempts")?,
                locked_until: row.try_get("locked_until")?,
                pin_hash: row.try_get("pin_hash")?,
                pin_salt: row.try_get("pin_salt")?,
            })
        })
        .transpose()
    }

    /// Sets or replaces the code; wrong attempts are forgotten.
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
             ON CONFLICT (family_subject) DO UPDATE SET
               pin_hash = excluded.pin_hash,
               pin_salt = excluded.pin_salt,
               failed_attempts = 0,
               locked_until = NULL,
               updated_at = excluded.updated_at",
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

    /// Counts a wrong attempt. The `max_failures`-th one locks the code for `lock_ms` and starts
    /// the count again. Returns the lock as it now stands, or `None` when there is no code.
    pub async fn record_parent_lock_failure(
        &self,
        google_subject: &str,
        max_failures: i64,
        lock_ms: Millis,
        now: Millis,
    ) -> Result<Option<ParentLock>> {
        {
            let (_guard, mut transaction) = self.write().await?;
            sqlx::query(
                "UPDATE parent_locks SET
                   locked_until = CASE WHEN failed_attempts + 1 >= ?1 THEN ?2 + ?3 ELSE locked_until END,
                   failed_attempts = CASE WHEN failed_attempts + 1 >= ?1 THEN 0 ELSE failed_attempts + 1 END,
                   updated_at = ?2
                 WHERE family_subject = ?4",
            )
            .bind(max_failures)
            .bind(now)
            .bind(lock_ms)
            .bind(google_subject)
            .execute(&mut *transaction)
            .await?;
            transaction.commit().await?;
        }
        self.parent_lock(google_subject).await
    }

    /// Forgets wrong attempts after the right code.
    pub async fn clear_parent_lock_failures(
        &self,
        google_subject: &str,
        now: Millis,
    ) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query(
            "UPDATE parent_locks SET failed_attempts = 0, locked_until = NULL, updated_at = ?
             WHERE family_subject = ? AND (failed_attempts > 0 OR locked_until IS NOT NULL)",
        )
        .bind(now)
        .bind(google_subject)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    /// Removes the code, so that the family can choose a new one.
    pub async fn remove_parent_lock(&self, google_subject: &str) -> Result<()> {
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
    use crate::testing::store;

    const MINUTE: i64 = 60_000;

    #[tokio::test]
    async fn locks_after_repeated_failures_and_resets() {
        let (store, _directory) = store().await;
        store
            .ensure_family("subject", "Lou", None, "sprout", 0)
            .await
            .expect("family");
        assert_eq!(store.parent_lock("subject").await.expect("read"), None);
        assert_eq!(
            store
                .record_parent_lock_failure("subject", 3, 15 * MINUTE, 0)
                .await
                .expect("no code"),
            None
        );

        store
            .set_parent_lock("subject", "hash", "salt", 1)
            .await
            .expect("set");
        for attempt in 1..=2 {
            let lock = store
                .record_parent_lock_failure("subject", 3, 15 * MINUTE, 10)
                .await
                .expect("failure")
                .expect("lock");
            assert_eq!(lock.failed_attempts, attempt);
            assert!(!lock.is_locked(10));
        }
        let lock = store
            .record_parent_lock_failure("subject", 3, 15 * MINUTE, 10)
            .await
            .expect("failure")
            .expect("lock");
        assert_eq!(lock.failed_attempts, 0);
        assert_eq!(lock.locked_until, Some(10 + 15 * MINUTE));
        assert!(lock.is_locked(11));
        assert!(!lock.is_locked(10 + 15 * MINUTE));

        store
            .clear_parent_lock_failures("subject", 20)
            .await
            .expect("clear");
        let lock = store
            .parent_lock("subject")
            .await
            .expect("read")
            .expect("lock");
        assert_eq!((lock.failed_attempts, lock.locked_until), (0, None));

        store
            .set_parent_lock("subject", "other", "pepper", 30)
            .await
            .expect("replace");
        let lock = store
            .parent_lock("subject")
            .await
            .expect("read")
            .expect("lock");
        assert_eq!(
            (lock.pin_hash.as_str(), lock.pin_salt.as_str()),
            ("other", "pepper")
        );

        store.remove_parent_lock("subject").await.expect("remove");
        assert_eq!(store.parent_lock("subject").await.expect("read"), None);
    }
}

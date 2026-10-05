//! SQLite storage for the little tables server.
//!
//! One database file holds every family. Writes go through a single connection lock so that each
//! multi-statement change, such as ingesting a batch and updating the learning projection, is one
//! atomic transaction.

mod attempts;
mod families;
mod garden;
mod reminders;

use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::{Sqlite, SqlitePool, Transaction};
use tokio::sync::Mutex;

pub use attempts::{AttemptSummary, InsertResult};
pub use families::{ChildProfile, Family, RemoveChildResult};
pub use garden::{GardenRecord, personalized_flower_order};
pub use reminders::{AllowedEmail, EmailStatus, PushSubscription};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("stored value is invalid: {0}")]
    Corrupt(String),
}

pub type Result<T> = std::result::Result<T, StoreError>;

pub(crate) fn corrupt(error: impl std::fmt::Display) -> StoreError {
    StoreError::Corrupt(error.to_string())
}

/// The database of one deployment.
pub struct Store {
    pool: SqlitePool,
    writer: Mutex<()>,
}

impl Store {
    /// Opens (and creates when missing) the database file, then applies pending migrations.
    pub async fn open(path: &Path) -> Result<Self> {
        let options = SqliteConnectOptions::from_str(&format!("sqlite://{}", path.display()))?
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .foreign_keys(true)
            .busy_timeout(Duration::from_secs(5));
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options)
            .await?;
        let store = Self {
            pool,
            writer: Mutex::new(()),
        };
        store.migrate().await?;
        Ok(store)
    }

    /// Applies the migrations bundled in the binary.
    pub async fn migrate(&self) -> Result<()> {
        sqlx::migrate!("./migrations").run(&self.pool).await?;
        Ok(())
    }

    /// Checks that the database answers.
    pub async fn health(&self) -> Result<()> {
        sqlx::query("SELECT 1").execute(&self.pool).await?;
        Ok(())
    }

    /// Writes a consistent copy of the database to `destination` (`VACUUM INTO`).
    pub async fn backup(&self, destination: &Path) -> Result<()> {
        sqlx::query("VACUUM INTO ?")
            .bind(destination.display().to_string())
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub(crate) async fn write(
        &self,
    ) -> Result<(tokio::sync::MutexGuard<'_, ()>, Transaction<'_, Sqlite>)> {
        let guard = self.writer.lock().await;
        let transaction = self.pool.begin().await?;
        Ok((guard, transaction))
    }

    pub(crate) fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

#[cfg(test)]
pub(crate) mod testing {
    use super::Store;

    /// A fresh database in a temporary directory, kept alive with the store.
    pub async fn store() -> (Store, tempfile::TempDir) {
        let directory = tempfile::tempdir().expect("temporary directory");
        let store = Store::open(&directory.path().join("test.db"))
            .await
            .expect("database opens");
        (store, directory)
    }
}

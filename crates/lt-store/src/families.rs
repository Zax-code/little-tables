//! Families: one Google account owns one family of child profiles.

use lt_domain::model::{LearningPathSettings, Millis};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::{Result, Store, corrupt};

/// A child of the family as the API returns it.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChildProfile {
    pub avatar_id: String,
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub learning_paths: Option<LearningPathSettings>,
    pub name: String,
    /// Minutes after local midnight for the daily reminder; `None` when switched off.
    #[serde(skip)]
    pub reminder_minute: Option<i64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Family {
    pub google_subject: String,
    pub onboarding_complete: bool,
    pub profiles: Vec<ChildProfile>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RemoveChildResult {
    Removed,
    LastProfile,
    NotFound,
}

fn profile_from(row: &sqlx::sqlite::SqliteRow) -> Result<ChildProfile> {
    let learning_paths: Option<String> = row.try_get("learning_paths")?;
    Ok(ChildProfile {
        avatar_id: row.try_get("avatar_id")?,
        id: row.try_get("id")?,
        learning_paths: learning_paths
            .map(|json| serde_json::from_str(&json).map_err(corrupt))
            .transpose()?,
        name: row.try_get("name")?,
        reminder_minute: row.try_get("reminder_minute")?,
    })
}

enum ProfileUpdate {
    Identity { avatar_id: String, name: String },
    LearningPaths(String),
    ReminderMinute(Option<i64>),
}

const PROFILE_COLUMNS: &str = "id, name, avatar_id, learning_paths, reminder_minute";

impl Store {
    pub async fn find_family(&self, google_subject: &str) -> Result<Option<Family>> {
        let family =
            sqlx::query("SELECT onboarding_complete FROM families WHERE google_subject = ?")
                .bind(google_subject)
                .fetch_optional(self.pool())
                .await?;
        let Some(family) = family else {
            return Ok(None);
        };
        let rows = sqlx::query(&format!(
            "SELECT {PROFILE_COLUMNS} FROM profiles WHERE family_subject = ? ORDER BY position"
        ))
        .bind(google_subject)
        .fetch_all(self.pool())
        .await?;
        Ok(Some(Family {
            google_subject: google_subject.to_owned(),
            onboarding_complete: family.try_get::<i64, _>("onboarding_complete")? != 0,
            profiles: rows.iter().map(profile_from).collect::<Result<_>>()?,
        }))
    }

    /// The family a profile belongs to.
    pub async fn profile_owner(&self, profile_id: &str) -> Result<Option<String>> {
        Ok(
            sqlx::query_scalar("SELECT family_subject FROM profiles WHERE id = ?")
                .bind(profile_id)
                .fetch_optional(self.pool())
                .await?,
        )
    }

    pub async fn find_profile(&self, profile_id: &str) -> Result<Option<ChildProfile>> {
        sqlx::query(&format!(
            "SELECT {PROFILE_COLUMNS} FROM profiles WHERE id = ?"
        ))
        .bind(profile_id)
        .fetch_optional(self.pool())
        .await?
        .as_ref()
        .map(profile_from)
        .transpose()
    }

    /// Returns the family, creating it with one child named `fallback_name` on first sign-in.
    /// `first_profile_id` keeps a historical id (the shared `lou` profile) for the owner.
    pub async fn ensure_family(
        &self,
        google_subject: &str,
        fallback_name: &str,
        first_profile_id: Option<&str>,
        default_avatar_id: &str,
        now: Millis,
    ) -> Result<Family> {
        if let Some(family) = self.find_family(google_subject).await? {
            return Ok(family);
        }
        {
            let (_guard, mut transaction) = self.write().await?;
            let inserted = sqlx::query(
                "INSERT INTO families (google_subject, onboarding_complete, created_at, updated_at)
                 VALUES (?, 0, ?, ?) ON CONFLICT DO NOTHING",
            )
            .bind(google_subject)
            .bind(now)
            .bind(now)
            .execute(&mut *transaction)
            .await?;
            if inserted.rows_affected() == 1 {
                let id = first_profile_id
                    .map_or_else(|| uuid::Uuid::new_v4().to_string(), str::to_owned);
                sqlx::query(
                    "INSERT INTO profiles (id, family_subject, position, name, avatar_id, created_at, updated_at)
                     VALUES (?, ?, 0, ?, ?, ?, ?)",
                )
                .bind(id)
                .bind(google_subject)
                .bind(fallback_name)
                .bind(default_avatar_id)
                .bind(now)
                .bind(now)
                .execute(&mut *transaction)
                .await?;
            }
            transaction.commit().await?;
        }
        self.find_family(google_subject)
            .await?
            .ok_or_else(|| corrupt("family vanished after creation"))
    }

    /// Names the first child and closes onboarding. False when onboarding was already complete.
    pub async fn complete_initial_profile(
        &self,
        google_subject: &str,
        profile_id: &str,
        name: &str,
        now: Millis,
    ) -> Result<bool> {
        let (_guard, mut transaction) = self.write().await?;
        let updated = sqlx::query(
            "UPDATE families SET onboarding_complete = 1, updated_at = ?
             WHERE google_subject = ? AND onboarding_complete = 0
               AND EXISTS (SELECT 1 FROM profiles WHERE id = ? AND family_subject = ?)",
        )
        .bind(now)
        .bind(google_subject)
        .bind(profile_id)
        .bind(google_subject)
        .execute(&mut *transaction)
        .await?;
        if updated.rows_affected() != 1 {
            return Ok(false);
        }
        sqlx::query("UPDATE profiles SET name = ?, updated_at = ? WHERE id = ?")
            .bind(name)
            .bind(now)
            .bind(profile_id)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(true)
    }

    pub async fn add_child(
        &self,
        google_subject: &str,
        name: &str,
        avatar_id: &str,
        now: Millis,
    ) -> Result<ChildProfile> {
        let id = uuid::Uuid::new_v4().to_string();
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query(
            "INSERT INTO profiles (id, family_subject, position, name, avatar_id, created_at, updated_at)
             VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM profiles WHERE family_subject = ?), ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(google_subject)
        .bind(google_subject)
        .bind(name)
        .bind(avatar_id)
        .bind(now)
        .bind(now)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("UPDATE families SET updated_at = ? WHERE google_subject = ?")
            .bind(now)
            .bind(google_subject)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(ChildProfile {
            avatar_id: avatar_id.to_owned(),
            id,
            learning_paths: None,
            name: name.to_owned(),
            reminder_minute: Some(1080),
        })
    }

    async fn update_profile(
        &self,
        google_subject: &str,
        profile_id: &str,
        update: ProfileUpdate,
        now: Millis,
    ) -> Result<Option<ChildProfile>> {
        {
            let (_guard, mut transaction) = self.write().await?;
            let query = match &update {
                ProfileUpdate::Identity { avatar_id, name } => sqlx::query(
                    "UPDATE profiles SET name = ?, avatar_id = ?, updated_at = ? WHERE id = ? AND family_subject = ?",
                )
                .bind(name)
                .bind(avatar_id),
                ProfileUpdate::LearningPaths(json) => sqlx::query(
                    "UPDATE profiles SET learning_paths = ?, updated_at = ? WHERE id = ? AND family_subject = ?",
                )
                .bind(json),
                ProfileUpdate::ReminderMinute(minute) => sqlx::query(
                    "UPDATE profiles SET reminder_minute = ?, updated_at = ? WHERE id = ? AND family_subject = ?",
                )
                .bind(*minute),
            };
            let updated = query
                .bind(now)
                .bind(profile_id)
                .bind(google_subject)
                .execute(&mut *transaction)
                .await?;
            if updated.rows_affected() != 1 {
                return Ok(None);
            }
            transaction.commit().await?;
        }
        self.find_profile(profile_id).await
    }

    pub async fn update_child(
        &self,
        google_subject: &str,
        profile_id: &str,
        name: &str,
        avatar_id: &str,
        now: Millis,
    ) -> Result<Option<ChildProfile>> {
        let update = ProfileUpdate::Identity {
            avatar_id: avatar_id.to_owned(),
            name: name.to_owned(),
        };
        self.update_profile(google_subject, profile_id, update, now)
            .await
    }

    pub async fn update_learning_paths(
        &self,
        google_subject: &str,
        profile_id: &str,
        settings: &LearningPathSettings,
        now: Millis,
    ) -> Result<Option<ChildProfile>> {
        let json = serde_json::to_string(settings).map_err(corrupt)?;
        self.update_profile(
            google_subject,
            profile_id,
            ProfileUpdate::LearningPaths(json),
            now,
        )
        .await
    }

    pub async fn update_reminder_minute(
        &self,
        google_subject: &str,
        profile_id: &str,
        minute: Option<i64>,
        now: Millis,
    ) -> Result<Option<ChildProfile>> {
        self.update_profile(
            google_subject,
            profile_id,
            ProfileUpdate::ReminderMinute(minute),
            now,
        )
        .await
    }

    /// Removes a child and, through cascading keys, all of its data.
    pub async fn remove_child(
        &self,
        google_subject: &str,
        profile_id: &str,
    ) -> Result<RemoveChildResult> {
        let (_guard, mut transaction) = self.write().await?;
        let ids: Vec<String> =
            sqlx::query_scalar("SELECT id FROM profiles WHERE family_subject = ?")
                .bind(google_subject)
                .fetch_all(&mut *transaction)
                .await?;
        if !ids.iter().any(|id| id == profile_id) {
            return Ok(RemoveChildResult::NotFound);
        }
        if ids.len() == 1 {
            return Ok(RemoveChildResult::LastProfile);
        }
        sqlx::query("DELETE FROM profiles WHERE id = ? AND family_subject = ?")
            .bind(profile_id)
            .bind(google_subject)
            .execute(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(RemoveChildResult::Removed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::store;

    #[tokio::test]
    async fn creates_a_family_once_and_keeps_profile_order() {
        let (store, _directory) = store().await;
        let family = store
            .ensure_family("g1", "léa", Some("lou"), "sprout", 1)
            .await
            .unwrap();
        assert!(!family.onboarding_complete);
        assert_eq!(family.profiles[0].id, "lou");
        let again = store
            .ensure_family("g1", "other", None, "sprout", 2)
            .await
            .unwrap();
        assert_eq!(again.profiles.len(), 1);
        let zoe = store.add_child("g1", "Zoé", "fenna-fox", 3).await.unwrap();
        let tom = store.add_child("g1", "Tom", "malo-bear", 4).await.unwrap();
        let family = store.find_family("g1").await.unwrap().unwrap();
        let ids: Vec<&str> = family
            .profiles
            .iter()
            .map(|profile| profile.id.as_str())
            .collect();
        assert_eq!(ids, ["lou", zoe.id.as_str(), tom.id.as_str()]);
    }

    #[tokio::test]
    async fn completes_onboarding_only_once() {
        let (store, _directory) = store().await;
        let family = store
            .ensure_family("g1", "léa", None, "sprout", 1)
            .await
            .unwrap();
        let id = &family.profiles[0].id;
        assert!(
            store
                .complete_initial_profile("g1", id, "Léa", 2)
                .await
                .unwrap()
        );
        assert!(
            !store
                .complete_initial_profile("g1", id, "Autre", 3)
                .await
                .unwrap()
        );
        let family = store.find_family("g1").await.unwrap().unwrap();
        assert!(family.onboarding_complete);
        assert_eq!(family.profiles[0].name, "Léa");
    }

    #[tokio::test]
    async fn updates_only_the_owners_profiles() {
        let (store, _directory) = store().await;
        let family = store
            .ensure_family("g1", "léa", None, "sprout", 1)
            .await
            .unwrap();
        store
            .ensure_family("g2", "max", None, "sprout", 1)
            .await
            .unwrap();
        let id = family.profiles[0].id.clone();
        assert!(
            store
                .update_child("g2", &id, "X", "sprout", 2)
                .await
                .unwrap()
                .is_none()
        );
        let updated = store
            .update_child("g1", &id, "Léa", "mina-cat", 2)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(updated.avatar_id, "mina-cat");
        let settings = LearningPathSettings::default();
        let updated = store
            .update_learning_paths("g1", &id, &settings, 3)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(updated.learning_paths, Some(settings));
        let updated = store
            .update_reminder_minute("g1", &id, None, 4)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(updated.reminder_minute, None);
    }

    #[tokio::test]
    async fn keeps_the_last_child() {
        let (store, _directory) = store().await;
        let family = store
            .ensure_family("g1", "léa", None, "sprout", 1)
            .await
            .unwrap();
        let first = family.profiles[0].id.clone();
        assert_eq!(
            store.remove_child("g1", &first).await.unwrap(),
            RemoveChildResult::LastProfile
        );
        let second = store.add_child("g1", "Zoé", "fenna-fox", 2).await.unwrap();
        assert_eq!(
            store.remove_child("g1", "nope").await.unwrap(),
            RemoveChildResult::NotFound
        );
        assert_eq!(
            store.remove_child("g1", &second.id).await.unwrap(),
            RemoveChildResult::Removed
        );
        assert_eq!(
            store
                .find_family("g1")
                .await
                .unwrap()
                .unwrap()
                .profiles
                .len(),
            1
        );
    }
}

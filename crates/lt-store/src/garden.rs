//! Each profile's garden: flower order, awarded flowers, blooms and rewarded days. Awards only
//! ever grow: reconciling keeps the union of flowers and days and the highest bloom count.

use lt_domain::garden::garden_flower_ids;
use lt_domain::model::Millis;
use rand::Rng;
use sqlx::Row;

use crate::{Result, Store, corrupt};

#[derive(Clone, Debug, PartialEq)]
pub struct GardenRecord {
    /// In flower order.
    pub awarded_flower_ids: Vec<String>,
    pub bloom_count: i64,
    pub catalog_version: String,
    pub flower_order: Vec<String>,
    pub introduction_seen: bool,
    pub rewarded_day_keys: Vec<String>,
}

/// The preferred prefix (known, unique ids) followed by the other flowers in random order.
pub fn personalized_flower_order(
    preferred_prefix: &[String],
    random: &mut impl Rng,
) -> Vec<String> {
    let known = garden_flower_ids();
    let mut prefix: Vec<String> = Vec::new();
    for id in preferred_prefix {
        if known.contains(id) && !prefix.contains(id) {
            prefix.push(id.clone());
        }
    }
    let mut remaining: Vec<String> = known
        .into_iter()
        .filter(|id| !prefix.contains(id))
        .collect();
    for index in (1..remaining.len()).rev() {
        let swap = random.gen_range(0..=index);
        remaining.swap(index, swap);
    }
    prefix.extend(remaining);
    prefix
}

fn record_from(row: &sqlx::sqlite::SqliteRow) -> Result<GardenRecord> {
    let list = |column: &str| -> Result<Vec<String>> {
        serde_json::from_str(&row.try_get::<String, _>(column)?).map_err(corrupt)
    };
    let flower_order = list("flower_order")?;
    let awarded = list("awarded_flower_ids")?;
    Ok(GardenRecord {
        awarded_flower_ids: flower_order
            .iter()
            .filter(|id| awarded.contains(id))
            .cloned()
            .collect(),
        bloom_count: row.try_get("bloom_count")?,
        catalog_version: row.try_get("catalog_version")?,
        flower_order,
        introduction_seen: row.try_get::<i64, _>("introduction_seen")? != 0,
        rewarded_day_keys: list("rewarded_day_keys")?,
    })
}

const COLUMNS: &str = "awarded_flower_ids, flower_order, bloom_count, rewarded_day_keys, introduction_seen, catalog_version";

fn union(current: Vec<String>, additions: &[String]) -> Vec<String> {
    let mut values = current;
    for value in additions {
        if !values.contains(value) {
            values.push(value.clone());
        }
    }
    values
}

impl Store {
    pub async fn find_garden(&self, profile_id: &str) -> Result<Option<GardenRecord>> {
        sqlx::query(&format!(
            "SELECT {COLUMNS} FROM garden_collections WHERE profile_id = ?"
        ))
        .bind(profile_id)
        .fetch_optional(self.pool())
        .await?
        .as_ref()
        .map(record_from)
        .transpose()
    }

    /// Returns the garden, creating it on first use with `flower_order`.
    pub async fn load_or_create_garden(
        &self,
        profile_id: &str,
        flower_order: &[String],
        now: Millis,
    ) -> Result<GardenRecord> {
        {
            let (_guard, mut transaction) = self.write().await?;
            sqlx::query(
                "INSERT INTO garden_collections (profile_id, awarded_flower_ids, flower_order, bloom_count,
                   rewarded_day_keys, introduction_seen, catalog_version, created_at, updated_at)
                 VALUES (?, '[]', ?, 0, '[]', 0, '1', ?, ?) ON CONFLICT (profile_id) DO NOTHING",
            )
            .bind(profile_id)
            .bind(serde_json::to_string(flower_order).map_err(corrupt)?)
            .bind(now)
            .bind(now)
            .execute(&mut *transaction)
            .await?;
            transaction.commit().await?;
        }
        self.find_garden(profile_id)
            .await?
            .ok_or_else(|| corrupt("garden vanished after creation"))
    }

    /// Adds awarded flowers and rewarded days, and keeps the highest bloom count.
    pub async fn reconcile_garden(
        &self,
        profile_id: &str,
        awarded_flower_ids: &[String],
        bloom_count: i64,
        rewarded_day_keys: &[String],
        now: Millis,
    ) -> Result<GardenRecord> {
        let (_guard, mut transaction) = self.write().await?;
        let row = sqlx::query(&format!(
            "SELECT {COLUMNS} FROM garden_collections WHERE profile_id = ?"
        ))
        .bind(profile_id)
        .fetch_one(&mut *transaction)
        .await?;
        let current = record_from(&row)?;
        let awarded = union(current.awarded_flower_ids, awarded_flower_ids);
        let days = union(current.rewarded_day_keys, rewarded_day_keys);
        sqlx::query(
            "UPDATE garden_collections SET awarded_flower_ids = ?, rewarded_day_keys = ?,
               bloom_count = MAX(bloom_count, ?), updated_at = ? WHERE profile_id = ?",
        )
        .bind(serde_json::to_string(&awarded).map_err(corrupt)?)
        .bind(serde_json::to_string(&days).map_err(corrupt)?)
        .bind(bloom_count)
        .bind(now)
        .bind(profile_id)
        .execute(&mut *transaction)
        .await?;
        let row = sqlx::query(&format!(
            "SELECT {COLUMNS} FROM garden_collections WHERE profile_id = ?"
        ))
        .bind(profile_id)
        .fetch_one(&mut *transaction)
        .await?;
        let record = record_from(&row)?;
        transaction.commit().await?;
        Ok(record)
    }

    /// Imports a garden exactly as the previous server stored it.
    #[allow(clippy::too_many_arguments)]
    pub async fn import_garden(
        &self,
        profile_id: &str,
        record: &GardenRecord,
        created_at: Millis,
        updated_at: Millis,
    ) -> Result<()> {
        let (_guard, mut transaction) = self.write().await?;
        sqlx::query(
            "INSERT INTO garden_collections (profile_id, awarded_flower_ids, flower_order, bloom_count,
               rewarded_day_keys, introduction_seen, catalog_version, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (profile_id) DO UPDATE SET awarded_flower_ids = excluded.awarded_flower_ids,
               flower_order = excluded.flower_order, bloom_count = excluded.bloom_count,
               rewarded_day_keys = excluded.rewarded_day_keys, introduction_seen = excluded.introduction_seen,
               catalog_version = excluded.catalog_version, updated_at = excluded.updated_at",
        )
        .bind(profile_id)
        .bind(serde_json::to_string(&record.awarded_flower_ids).map_err(corrupt)?)
        .bind(serde_json::to_string(&record.flower_order).map_err(corrupt)?)
        .bind(record.bloom_count)
        .bind(serde_json::to_string(&record.rewarded_day_keys).map_err(corrupt)?)
        .bind(record.introduction_seen)
        .bind(&record.catalog_version)
        .bind(created_at)
        .bind(updated_at)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok(())
    }

    /// Marks the garden introduction as seen. `None` when the profile has no garden yet.
    pub async fn mark_introduction_seen(
        &self,
        profile_id: &str,
        now: Millis,
    ) -> Result<Option<GardenRecord>> {
        {
            let (_guard, mut transaction) = self.write().await?;
            sqlx::query("UPDATE garden_collections SET introduction_seen = 1, updated_at = ? WHERE profile_id = ?")
                .bind(now)
                .bind(profile_id)
                .execute(&mut *transaction)
                .await?;
            transaction.commit().await?;
        }
        self.find_garden(profile_id).await
    }
}

#[cfg(test)]
mod tests {
    use rand::SeedableRng;

    use super::*;
    use crate::testing::store;

    #[test]
    fn keeps_the_prefix_and_shuffles_the_rest() {
        let mut random = rand::rngs::StdRng::seed_from_u64(3);
        let order = personalized_flower_order(
            &[
                "twilight-lupine".to_owned(),
                "nope".to_owned(),
                "twilight-lupine".to_owned(),
            ],
            &mut random,
        );
        assert_eq!(order.len(), 9);
        assert_eq!(order[0], "twilight-lupine");
        let mut sorted = order.clone();
        sorted.sort();
        let mut expected = garden_flower_ids();
        expected.sort();
        assert_eq!(sorted, expected);
    }

    #[tokio::test]
    async fn creates_once_and_only_grows() {
        let (store, _directory) = store().await;
        let profile = store
            .ensure_family("g", "léa", None, "sprout", 0)
            .await
            .unwrap()
            .profiles[0]
            .id
            .clone();
        let order = garden_flower_ids();
        let created = store
            .load_or_create_garden(&profile, &order, 1)
            .await
            .unwrap();
        assert_eq!(created.bloom_count, 0);
        let reversed: Vec<String> = order.iter().rev().cloned().collect();
        let again = store
            .load_or_create_garden(&profile, &reversed, 2)
            .await
            .unwrap();
        assert_eq!(again.flower_order, order);
        let grown = store
            .reconcile_garden(
                &profile,
                &["twilight-lupine".to_owned(), "rose-lotus".to_owned()],
                4,
                &["2026-01-05".to_owned()],
                3,
            )
            .await
            .unwrap();
        assert_eq!(grown.awarded_flower_ids, ["rose-lotus", "twilight-lupine"]);
        let kept = store
            .reconcile_garden(&profile, &[], 2, &["2026-01-06".to_owned()], 4)
            .await
            .unwrap();
        assert_eq!(kept.bloom_count, 4);
        assert_eq!(kept.rewarded_day_keys, ["2026-01-05", "2026-01-06"]);
        assert!(
            store
                .mark_introduction_seen(&profile, 5)
                .await
                .unwrap()
                .unwrap()
                .introduction_seen
        );
    }
}

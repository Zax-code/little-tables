//! A profile's complete state, as the `/api/v1/bootstrap` endpoint returned it.
//!
//! Every step mirrors the previous server: the snapshot reduces all events in `(answeredAt,
//! sequence)` order with UTC days; a session counts as completed by its first answer to its last
//! question; blooms come from daily waterings, merged with the stored garden, which only grows.

use lt_domain::garden::{
    GARDEN_BLOOMS_PER_FLOWER, GardenInput, GardenPlantStage, GardenReward, LedgerTotals,
    SessionCompletionDay, derive_garden_progress, derive_garden_reward_ledger,
    derive_meadow_reward_ledger, derive_rewards, garden_flower_ids, merge_garden_reward_ledgers,
};
use lt_domain::model::{LearningSnapshot, Millis};
use lt_store::{GardenRecord, Store, personalized_flower_order};
use serde_json::{Value, json};

/// An instant as JavaScript's `Date.prototype.toISOString` writes it.
pub fn iso_instant(millis: Millis) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(millis)
        .unwrap_or_default()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

/// The snapshot with instants written as ISO strings, as the v1 contract expects.
pub fn v1_snapshot(snapshot: &LearningSnapshot) -> Value {
    let mut value = serde_json::to_value(snapshot).expect("snapshots serialise");
    if let Some(facts) = value.get_mut("facts").and_then(Value::as_object_mut) {
        for fact in facts.values_mut() {
            for field in ["dueAt", "lastReviewedAt"] {
                if let Some(slot) = fact.get_mut(field)
                    && let Some(millis) = slot.as_i64()
                {
                    *slot = Value::String(iso_instant(millis));
                }
            }
        }
    }
    value
}

/// Everything a profile's screens are derived from.
pub struct ProfileState {
    pub collection: GardenRecord,
    pub completed_sessions: usize,
    pub garden_bloom_count: i64,
    /// The meadow's blooms, derived from its waterings alone: it has no imported history.
    pub meadow_bloom_count: i64,
    pub meadow_rewarded_day_keys: Vec<String>,
    pub practice_day_keys: Vec<String>,
    pub rewarded_day_keys: Vec<String>,
    pub rewards: Vec<GardenReward>,
    pub snapshot: LearningSnapshot,
}

/// Computes the profile's state, creating and reconciling its garden on the way.
pub async fn profile_state(
    store: &Store,
    profile_id: &str,
    now: Millis,
) -> lt_store::Result<ProfileState> {
    let snapshot = store.snapshot(profile_id, now).await?;
    let attempts = store.attempt_summaries(profile_id).await?;

    let mut completed_sessions: Vec<&str> = Vec::new();
    let mut completions = Vec::new();
    for attempt in &attempts {
        if attempt.sequence == attempt.question_count - 1
            && !completed_sessions.contains(&attempt.session_id.as_str())
        {
            completed_sessions.push(&attempt.session_id);
            completions.push(SessionCompletionDay {
                learning_day_key: attempt.day_key.clone(),
                session_kind: attempt.session_kind,
            });
        }
    }
    let mut practice_day_keys: Vec<String> = attempts
        .iter()
        .map(|attempt| attempt.day_key.clone())
        .collect();
    practice_day_keys.sort();
    practice_day_keys.dedup();

    let derived = derive_garden_reward_ledger(&completions, 0.0, &[]);
    let meadow = derive_meadow_reward_ledger(&completions, 0.0, &[]);
    let flower_ids = garden_flower_ids();
    let prefix_length = if derived.garden_bloom_count == 0 {
        0
    } else {
        flower_ids
            .len()
            .min((derived.garden_bloom_count.max(0) as u64).div_ceil(5) as usize)
    };
    let order = personalized_flower_order(&flower_ids[..prefix_length], &mut rand::thread_rng());
    let initial = store.load_or_create_garden(profile_id, &order, now).await?;
    let rewards = merge_garden_reward_ledgers(&[
        LedgerTotals {
            garden_bloom_count: derived.garden_bloom_count,
            rewarded_day_keys: derived.rewarded_day_keys,
        },
        LedgerTotals {
            garden_bloom_count: initial.bloom_count,
            rewarded_day_keys: initial.rewarded_day_keys.clone(),
        },
    ]);
    let progress = derive_garden_progress(&GardenInput {
        awarded_flower_ids: Some(&initial.awarded_flower_ids),
        completed_sessions: rewards.garden_bloom_count as f64,
        flower_order: Some(&initial.flower_order),
        snapshot: &snapshot,
    });
    let mut awarded = initial.awarded_flower_ids.clone();
    awarded.extend(
        progress
            .plants
            .iter()
            .filter(|plant| plant.stage == GardenPlantStage::Mature)
            .map(|plant| plant.id.clone()),
    );
    let collection = store
        .reconcile_garden(
            profile_id,
            &awarded,
            rewards.garden_bloom_count,
            &rewards.rewarded_day_keys,
            now,
        )
        .await?;
    let garden_rewards = derive_rewards(&GardenInput {
        awarded_flower_ids: Some(&collection.awarded_flower_ids),
        completed_sessions: rewards.garden_bloom_count as f64,
        flower_order: Some(&collection.flower_order),
        snapshot: &snapshot,
    });
    Ok(ProfileState {
        collection,
        completed_sessions: completed_sessions.len(),
        garden_bloom_count: rewards.garden_bloom_count,
        meadow_bloom_count: meadow.garden_bloom_count,
        meadow_rewarded_day_keys: meadow.rewarded_day_keys,
        practice_day_keys,
        rewarded_day_keys: rewards.rewarded_day_keys,
        rewards: garden_rewards,
        snapshot,
    })
}

/// The garden collection as both API versions write it.
pub fn collection_json(collection: &GardenRecord) -> Value {
    json!({
        "awardedFlowerIds": collection.awarded_flower_ids,
        "bloomsPerFlower": GARDEN_BLOOMS_PER_FLOWER,
        "catalogVersion": collection.catalog_version,
        "flowerOrder": collection.flower_order,
        "introductionSeen": collection.introduction_seen,
    })
}

pub async fn v1_bootstrap(
    store: &Store,
    profile_id: &str,
    display_name: &str,
    now: Millis,
) -> lt_store::Result<Value> {
    let state = profile_state(store, profile_id, now).await?;
    Ok(json!({
        "algorithmVersion": state.snapshot.algorithm_version,
        "profile": { "displayName": display_name, "id": profile_id },
        "completedSessions": state.completed_sessions,
        "gardenBloomCount": state.garden_bloom_count,
        "gardenCollection": collection_json(&state.collection),
        "practiceDayKeys": state.practice_day_keys,
        "rewardedDayKeys": state.rewarded_day_keys,
        "rewards": state.rewards,
        "snapshot": v1_snapshot(&state.snapshot),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_instants_like_javascript() {
        assert_eq!(iso_instant(1_767_634_200_000), "2026-01-05T17:30:00.000Z");
        assert_eq!(iso_instant(1_767_634_200_045), "2026-01-05T17:30:00.045Z");
        assert_eq!(iso_instant(-1), "1969-12-31T23:59:59.999Z");
    }
}

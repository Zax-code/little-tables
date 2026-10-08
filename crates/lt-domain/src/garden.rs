//! The garden: one bloom per learning day of daily watering, nine flowers in three chapters.

use serde::{Deserialize, Serialize};

use crate::model::{LearningSnapshot, MasteryState, SessionKind};

pub const GARDEN_BLOOMS_PER_FLOWER: i64 = 3;

/// Flower ids in their default order, with their display names.
pub const GARDEN_FLOWERS: [(&str, &str); 9] = [
    ("rose-lotus", "rose lotus"),
    ("twilight-lupine", "twilight lupine"),
    ("velvet-foxglove", "velvet foxglove"),
    ("plum-snapdragon", "plum snapdragon"),
    ("sunset-zinnia", "sunset zinnia"),
    ("ruby-bleeding-heart", "ruby bleeding heart"),
    ("blushing-peony", "blushing peony"),
    ("ivory-magnolia", "ivory magnolia"),
    ("blue-wisteria", "blue wisteria"),
];

const GARDEN_CHAPTERS: [(&str, &str); 3] = [
    ("sunny-meadow", "sunny meadow"),
    ("secret-greenhouse", "secret greenhouse"),
    ("starlit-garden", "starlit garden"),
];

/// Fluent facts each chapter's last flower waits for.
const CHAPTER_MASTERY: [i64; 3] = [5, 15, 30];

pub fn garden_flower_ids() -> Vec<String> {
    GARDEN_FLOWERS
        .iter()
        .map(|(id, _)| (*id).to_owned())
        .collect()
}

fn flower_name(id: &str) -> String {
    GARDEN_FLOWERS
        .iter()
        .find(|(candidate, _)| *candidate == id)
        .map_or_else(|| id.to_owned(), |(_, name)| (*name).to_owned())
}

/// Known ids first in the given order, then the remaining flowers in default order.
pub fn normalized_flower_order(flower_order: Option<&[String]>) -> Vec<String> {
    let mut unique: Vec<String> = Vec::new();
    for id in flower_order.unwrap_or_default() {
        if GARDEN_FLOWERS.iter().any(|(known, _)| known == id) && !unique.contains(id) {
            unique.push(id.clone());
        }
    }
    for (id, _) in GARDEN_FLOWERS {
        if !unique.iter().any(|existing| existing == id) {
            unique.push(id.to_owned());
        }
    }
    unique
}

/* ------------------------------------------------------------------------------------------ */
/* Bloom ledger                                                                               */
/* ------------------------------------------------------------------------------------------ */

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionCompletionDay {
    pub learning_day_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_kind: Option<SessionKind>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GardenRewardLedger {
    pub garden_bloom_count: i64,
    pub garden_blooms_earned: i64,
    pub rewarded_day_keys: Vec<String>,
}

/// Adds one bloom per learning day that a daily watering completed and that was not rewarded yet.
pub fn derive_garden_reward_ledger(
    completions: &[SessionCompletionDay],
    garden_bloom_count: f64,
    rewarded_day_keys: &[String],
) -> GardenRewardLedger {
    // Extra practice and the meadow's watering never water the garden; a completion without a
    // kind predates the kinds and was a daily watering.
    derive_ledger(
        completions,
        |kind| {
            !matches!(
                kind,
                Some(SessionKind::ExtraPractice | SessionKind::MeadowWatering)
            )
        },
        garden_bloom_count,
        rewarded_day_keys,
    )
}

/// The meadow's blooms: one per learning day with a meadow watering, as for the garden. The
/// server derives them from the events alone; the app adds a completion to what it knows.
pub fn derive_meadow_reward_ledger(
    completions: &[SessionCompletionDay],
    meadow_bloom_count: f64,
    rewarded_day_keys: &[String],
) -> GardenRewardLedger {
    derive_ledger(
        completions,
        |kind| kind == Some(SessionKind::MeadowWatering),
        meadow_bloom_count,
        rewarded_day_keys,
    )
}

fn derive_ledger(
    completions: &[SessionCompletionDay],
    blooms: impl Fn(Option<SessionKind>) -> bool,
    garden_bloom_count: f64,
    rewarded_day_keys: &[String],
) -> GardenRewardLedger {
    let mut rewarded: Vec<String> = Vec::new();
    for key in rewarded_day_keys {
        if !rewarded.contains(key) {
            rewarded.push(key.clone());
        }
    }
    let floor = if garden_bloom_count.is_finite() {
        garden_bloom_count.floor() as i64
    } else {
        0
    };
    let mut bloom_count = floor.max(rewarded.len() as i64).max(0);
    let mut earned = 0;
    for completion in completions {
        if !blooms(completion.session_kind) || rewarded.contains(&completion.learning_day_key) {
            continue;
        }
        rewarded.push(completion.learning_day_key.clone());
        bloom_count += 1;
        earned += 1;
    }
    rewarded.sort();
    GardenRewardLedger {
        garden_bloom_count: bloom_count,
        garden_blooms_earned: earned,
        rewarded_day_keys: rewarded,
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerTotals {
    pub garden_bloom_count: i64,
    pub rewarded_day_keys: Vec<String>,
}

/// Keeps the highest count and every rewarded day of several ledgers.
pub fn merge_garden_reward_ledgers(ledgers: &[LedgerTotals]) -> GardenRewardLedger {
    let highest = ledgers
        .iter()
        .map(|ledger| ledger.garden_bloom_count)
        .fold(0, i64::max);
    let days: Vec<String> = ledgers
        .iter()
        .flat_map(|ledger| ledger.rewarded_day_keys.iter().cloned())
        .collect();
    derive_garden_reward_ledger(&[], highest as f64, &days)
}

/* ------------------------------------------------------------------------------------------ */
/* Progress and rewards                                                                       */
/* ------------------------------------------------------------------------------------------ */

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GardenPlantStage {
    Dormant,
    Growing,
    Locked,
    Mature,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GardenChapterStage {
    Complete,
    Growing,
    Locked,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GardenRewardKind {
    Background,
    Flower,
    Pot,
    Sparkle,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct GardenReward {
    pub id: String,
    pub kind: GardenRewardKind,
    pub label: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GardenPlantProgress {
    pub blooms_earned: i64,
    pub blooms_required: i64,
    pub chapter_id: String,
    pub collected: bool,
    pub id: String,
    pub locked_until_start: bool,
    pub mastery_remaining: i64,
    pub mastery_required: i64,
    pub mature_at: i64,
    pub name: String,
    pub stage: GardenPlantStage,
    pub start_at: i64,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GardenTargetStage {
    Growing,
    Mature,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GardenNextStep {
    pub blocked_by_mastery: bool,
    pub blooms_remaining: i64,
    pub fluent_facts_remaining: i64,
    pub plant: GardenPlantProgress,
    pub practice_days_remaining: i64,
    pub target_at: i64,
    pub target_stage: GardenTargetStage,
    pub unlocks_pot: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GardenChapterProgress {
    pub collected_count: i64,
    pub id: String,
    pub mature_at: i64,
    pub name: String,
    pub plants: Vec<GardenPlantProgress>,
    pub stage: GardenChapterStage,
    pub start_at: i64,
    pub total_count: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GardenCollectionProgress {
    pub collected_count: i64,
    pub complete: bool,
    pub total_count: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GardenProgress {
    pub bloom_count: i64,
    pub chapters: Vec<GardenChapterProgress>,
    pub collection: GardenCollectionProgress,
    pub featured_plant: Option<GardenPlantProgress>,
    pub next_step: Option<GardenNextStep>,
    pub plants: Vec<GardenPlantProgress>,
    pub rewards: Vec<GardenReward>,
}

/// What the garden is derived from.
#[derive(Clone, Debug)]
pub struct GardenInput<'a> {
    pub awarded_flower_ids: Option<&'a [String]>,
    /// Blooms so far. Not a number counts as none.
    pub completed_sessions: f64,
    pub flower_order: Option<&'a [String]>,
    pub snapshot: &'a LearningSnapshot,
}

fn fluent_facts(snapshot: &LearningSnapshot) -> i64 {
    snapshot
        .facts
        .values()
        .filter(|mastery| mastery.state == MasteryState::Fluent)
        .count() as i64
}

fn mastery_required(index: usize) -> i64 {
    if index % 3 == 2 {
        CHAPTER_MASTERY.get(index / 3).copied().unwrap_or(0)
    } else {
        0
    }
}

pub fn derive_rewards(input: &GardenInput<'_>) -> Vec<GardenReward> {
    let completed = input.completed_sessions;
    let fluent = fluent_facts(input.snapshot);
    let mut awarded: Vec<String> = input.awarded_flower_ids.unwrap_or_default().to_vec();
    let mut rewards = Vec::new();
    for (index, id) in normalized_flower_order(input.flower_order)
        .iter()
        .enumerate()
    {
        if completed >= ((index as i64 + 1) * GARDEN_BLOOMS_PER_FLOWER) as f64
            && fluent >= mastery_required(index)
        {
            awarded.push(id.clone());
        }
        if awarded.contains(id) {
            rewards.push(GardenReward {
                id: format!("collection:{id}"),
                kind: GardenRewardKind::Flower,
                label: flower_name(id),
            });
        }
    }
    let reward = |id: &str, kind, label: &str| GardenReward {
        id: id.to_owned(),
        kind,
        label: label.to_owned(),
    };
    if completed >= 5.0 {
        rewards.push(reward(
            "session:five-pink-pot",
            GardenRewardKind::Pot,
            "pink pot",
        ));
    }
    if fluent >= 10 {
        rewards.push(reward(
            "mastery:ten-sparkle",
            GardenRewardKind::Sparkle,
            "garden sparkle",
        ));
    }
    if completed >= 9.0 && fluent >= 5 {
        rewards.push(reward(
            "chapter:sunny-meadow",
            GardenRewardKind::Pot,
            "sunny meadow pot",
        ));
    }
    if completed >= 18.0 && fluent >= 15 {
        rewards.push(reward(
            "chapter:secret-greenhouse",
            GardenRewardKind::Background,
            "secret greenhouse backdrop",
        ));
    }
    if completed >= 27.0 && fluent >= 30 {
        rewards.push(reward(
            "chapter:starlit-garden",
            GardenRewardKind::Sparkle,
            "starlit garden glow",
        ));
    }
    rewards
}

pub fn derive_garden_progress(input: &GardenInput<'_>) -> GardenProgress {
    let bloom_count = if input.completed_sessions.is_finite() {
        (input.completed_sessions.floor() as i64).max(0)
    } else {
        0
    };
    let fluent = fluent_facts(input.snapshot);
    let awarded: &[String] = input.awarded_flower_ids.unwrap_or_default();
    let order = normalized_flower_order(input.flower_order);
    let plants: Vec<GardenPlantProgress> = order
        .iter()
        .enumerate()
        .map(|(index, id)| {
            let chapter = GARDEN_CHAPTERS[index / 3].0;
            let locked_until_start = index % 3 == 2;
            let required = mastery_required(index);
            let start_at = index as i64 * GARDEN_BLOOMS_PER_FLOWER + 1;
            let mature_at = (index as i64 + 1) * GARDEN_BLOOMS_PER_FLOWER;
            let mastery_remaining = (required - fluent).max(0);
            let permanently_awarded = awarded.contains(id);
            let stage = if permanently_awarded {
                GardenPlantStage::Mature
            } else if bloom_count < start_at {
                if locked_until_start {
                    GardenPlantStage::Locked
                } else {
                    GardenPlantStage::Dormant
                }
            } else if mastery_remaining > 0 {
                GardenPlantStage::Locked
            } else if bloom_count < mature_at {
                GardenPlantStage::Growing
            } else {
                GardenPlantStage::Mature
            };
            GardenPlantProgress {
                blooms_earned: if permanently_awarded {
                    GARDEN_BLOOMS_PER_FLOWER
                } else {
                    (bloom_count - start_at + 1).clamp(0, GARDEN_BLOOMS_PER_FLOWER)
                },
                blooms_required: GARDEN_BLOOMS_PER_FLOWER,
                chapter_id: chapter.to_owned(),
                collected: permanently_awarded || stage == GardenPlantStage::Mature,
                id: id.clone(),
                locked_until_start,
                mastery_remaining: if permanently_awarded {
                    0
                } else {
                    mastery_remaining
                },
                mastery_required: required,
                mature_at,
                name: flower_name(id),
                stage,
                start_at,
            }
        })
        .collect();

    let next_plant = plants
        .iter()
        .find(|plant| plant.stage != GardenPlantStage::Mature);
    let next_target = next_plant.map(|plant| {
        if plant.stage == GardenPlantStage::Growing
            || (plant.mastery_remaining > 0 && bloom_count >= plant.start_at)
        {
            (plant.mature_at, GardenTargetStage::Mature)
        } else {
            (plant.start_at, GardenTargetStage::Growing)
        }
    });
    let practice_days_remaining =
        next_target.map_or(0, |(target_at, _)| (target_at - bloom_count).max(0));
    let chapters: Vec<GardenChapterProgress> = GARDEN_CHAPTERS
        .iter()
        .enumerate()
        .map(|(chapter_index, (id, name))| {
            let chapter_plants: Vec<GardenPlantProgress> = plants
                .iter()
                .filter(|plant| plant.chapter_id == *id)
                .cloned()
                .collect();
            let collected_count = chapter_plants
                .iter()
                .filter(|plant| plant.collected)
                .count() as i64;
            let start_at = chapter_index as i64 * 3 * GARDEN_BLOOMS_PER_FLOWER + 1;
            GardenChapterProgress {
                collected_count,
                id: (*id).to_owned(),
                mature_at: (chapter_index as i64 + 1) * 3 * GARDEN_BLOOMS_PER_FLOWER,
                name: (*name).to_owned(),
                stage: if collected_count == chapter_plants.len() as i64 {
                    GardenChapterStage::Complete
                } else if bloom_count >= start_at {
                    GardenChapterStage::Growing
                } else {
                    GardenChapterStage::Locked
                },
                start_at,
                total_count: chapter_plants.len() as i64,
                plants: chapter_plants,
            }
        })
        .collect();
    let collected_count = plants.iter().filter(|plant| plant.collected).count() as i64;

    GardenProgress {
        bloom_count,
        chapters,
        collection: GardenCollectionProgress {
            collected_count,
            complete: collected_count == plants.len() as i64,
            total_count: plants.len() as i64,
        },
        featured_plant: plants
            .iter()
            .find(|plant| {
                plant.stage != GardenPlantStage::Locked
                    && bloom_count >= plant.start_at
                    && bloom_count <= plant.mature_at
            })
            .cloned(),
        next_step: match (next_plant, next_target) {
            (Some(plant), Some((target_at, target_stage))) => Some(GardenNextStep {
                blocked_by_mastery: plant.mastery_remaining > 0 && practice_days_remaining == 0,
                blooms_remaining: practice_days_remaining,
                fluent_facts_remaining: plant.mastery_remaining,
                plant: plant.clone(),
                practice_days_remaining,
                target_at,
                target_stage,
                unlocks_pot: plant.locked_until_start && target_stage == GardenTargetStage::Growing,
            }),
            _ => None,
        },
        rewards: derive_rewards(&GardenInput {
            completed_sessions: bloom_count as f64,
            ..input.clone()
        }),
        plants,
    }
}

//! The verb meadow: one flower per ticked verb, butterflies on the verbs worked this week, and the
//! thirst that invites the child back to conjugation (`docs/conjugation/PRE_DES_VERBES.md`).
//!
//! Everything is derived from the snapshot and the parent's settings; nothing is stored.

use serde::Serialize;

use crate::conjugation::VerbGroup;
use crate::day_key::{days_between, shift_day_key};
use crate::model::{AttemptEvent, ConjugationSettings, LearningSnapshot, MasteryState, Tense};

/// Days without conjugation after which the verbs are thirsty.
pub const MEADOW_THIRST_DAYS: i64 = 3;
/// Correct answers on one verb that bring a butterfly to it in a session.
pub const MEADOW_VISIT_ANSWERS: usize = 3;
/// Days, today included, whose butterflies the meadow shows.
const MEADOW_WEEK_DAYS: i64 = 7;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MeadowSilhouette {
    Sunflower,
    Tulip,
    Daisy,
    Cosmos,
    Bellflower,
    Cornflower,
    Dahlia,
    Poppy,
    Anemone,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MeadowPalette {
    Gold,
    Rose,
    Indigo,
    Coral,
    Violet,
    Mint,
    Red,
    White,
    Peach,
    Lavender,
}

pub const MEADOW_PALETTES: [MeadowPalette; 10] = [
    MeadowPalette::Gold,
    MeadowPalette::Rose,
    MeadowPalette::Indigo,
    MeadowPalette::Coral,
    MeadowPalette::Violet,
    MeadowPalette::Mint,
    MeadowPalette::Red,
    MeadowPalette::White,
    MeadowPalette::Peach,
    MeadowPalette::Lavender,
];

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MeadowStage {
    Seed,
    Growing,
    Mature,
}

pub struct MeadowInput<'a> {
    pub settings: Option<&'a ConjugationSettings>,
    pub snapshot: &'a LearningSnapshot,
    pub today_key: &'a str,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct MeadowTense {
    pub state: MasteryState,
    pub tense: Tense,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeadowVerb {
    pub verb: String,
    pub group: VerbGroup,
    pub silhouette: MeadowSilhouette,
    pub palette: MeadowPalette,
    pub stage: MeadowStage,
    /// The ticked tenses, in the parent's order.
    pub tenses: Vec<MeadowTense>,
    /// The days of the last seven when a butterfly landed on the verb, oldest first.
    pub butterfly_day_keys: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeadowThirst {
    pub verb: String,
    pub days_since: i64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeadowProgress {
    /// Auxiliaries, then the first, second and third groups; the parent's order within a group.
    pub verbs: Vec<MeadowVerb>,
    pub butterflies_this_week: i64,
    pub thirst: Option<MeadowThirst>,
}

/// FNV-1a, 32 bits, over the UTF-8 bytes of the infinitive.
pub fn verb_hash(verb: &str) -> u32 {
    verb.bytes().fold(0x811c_9dc5, |hash, byte| {
        (hash ^ u32::from(byte)).wrapping_mul(0x0100_0193)
    })
}

/// The silhouettes a group draws from.
pub fn group_silhouettes(group: VerbGroup) -> &'static [MeadowSilhouette] {
    match group {
        VerbGroup::Auxiliary => &[MeadowSilhouette::Sunflower, MeadowSilhouette::Tulip],
        VerbGroup::First => &[
            MeadowSilhouette::Daisy,
            MeadowSilhouette::Cosmos,
            MeadowSilhouette::Bellflower,
        ],
        VerbGroup::Second => &[MeadowSilhouette::Cornflower, MeadowSilhouette::Dahlia],
        VerbGroup::Third => &[MeadowSilhouette::Poppy, MeadowSilhouette::Anemone],
    }
}

/// The flower a verb would have alone in its group.
pub fn verb_flower(group: VerbGroup, verb: &str) -> (MeadowSilhouette, MeadowPalette) {
    let silhouettes = group_silhouettes(group);
    let hash = verb_hash(verb) as usize;
    (
        silhouettes[hash % silhouettes.len()],
        MEADOW_PALETTES[hash / 7 % MEADOW_PALETTES.len()],
    )
}

/// The flowers of the verbs of one group, in order. A verb whose flower is taken by an earlier one
/// moves to the next free palette, then the next silhouette; past every pair, collisions stay.
pub fn assign_flowers(
    group: VerbGroup,
    verbs: &[String],
) -> Vec<(MeadowSilhouette, MeadowPalette)> {
    let silhouettes = group_silhouettes(group);
    let pairs = silhouettes.len() * MEADOW_PALETTES.len();
    let index_of = |(silhouette, palette): (MeadowSilhouette, MeadowPalette)| {
        let row = silhouettes
            .iter()
            .position(|s| *s == silhouette)
            .unwrap_or(0);
        let column = MEADOW_PALETTES
            .iter()
            .position(|p| *p == palette)
            .unwrap_or(0);
        row * MEADOW_PALETTES.len() + column
    };
    let pair_at = |index: usize| {
        (
            silhouettes[index / MEADOW_PALETTES.len()],
            MEADOW_PALETTES[index % MEADOW_PALETTES.len()],
        )
    };
    let mut taken = vec![false; pairs];
    verbs
        .iter()
        .map(|verb| {
            let start = index_of(verb_flower(group, verb));
            let index = (0..pairs)
                .map(|step| (start + step) % pairs)
                .find(|index| !taken[*index])
                .unwrap_or(start);
            taken[index] = true;
            pair_at(index)
        })
        .collect()
}

fn unique<T: Clone + PartialEq>(items: &[T]) -> Vec<T> {
    let mut seen: Vec<T> = Vec::new();
    for item in items {
        if !seen.contains(item) {
            seen.push(item.clone());
        }
    }
    seen
}

/// The latest day any tense of the verb was reviewed.
fn last_reviewed(snapshot: &LearningSnapshot, verb: &str) -> Option<String> {
    Tense::ALL
        .into_iter()
        .filter_map(|tense| {
            snapshot
                .facts
                .get(&crate::conjugation::key(verb, tense))?
                .last_reviewed_day_key
                .clone()
        })
        .max()
}

pub fn derive_meadow(input: &MeadowInput) -> MeadowProgress {
    let Some(settings) = input.settings else {
        return MeadowProgress {
            verbs: Vec::new(),
            butterflies_this_week: 0,
            thirst: None,
        };
    };
    let tenses = unique(&settings.tenses);
    let known: Vec<(String, VerbGroup)> = unique(&settings.verbs)
        .into_iter()
        .filter_map(|verb| {
            let group = crate::conjugation::lookup(&verb)?.group;
            Some((verb, group))
        })
        .collect();
    let week: Vec<String> = (1 - MEADOW_WEEK_DAYS..=0)
        .map(|offset| shift_day_key(input.today_key, offset))
        .collect();

    let mut verbs: Vec<MeadowVerb> = Vec::new();
    for group in [
        VerbGroup::Auxiliary,
        VerbGroup::First,
        VerbGroup::Second,
        VerbGroup::Third,
    ] {
        let names: Vec<String> = known
            .iter()
            .filter(|(_, candidate)| *candidate == group)
            .map(|(verb, _)| verb.clone())
            .collect();
        for (verb, (silhouette, palette)) in names.iter().zip(assign_flowers(group, &names)) {
            let facts: Vec<_> = tenses
                .iter()
                .map(|tense| {
                    (
                        *tense,
                        input
                            .snapshot
                            .facts
                            .get(&crate::conjugation::key(verb, *tense)),
                    )
                })
                .collect();
            let states: Vec<MeadowTense> = facts
                .iter()
                .map(|(tense, fact)| MeadowTense {
                    state: fact.map_or(MasteryState::Unseen, |fact| fact.state),
                    tense: *tense,
                })
                .collect();
            let stage = if states.iter().all(|t| t.state == MasteryState::Unseen) {
                MeadowStage::Seed
            } else if states.iter().all(|t| t.state == MasteryState::Fluent) {
                MeadowStage::Mature
            } else {
                MeadowStage::Growing
            };
            let butterfly_day_keys = week
                .iter()
                .filter(|day| {
                    facts.iter().any(|(_, fact)| {
                        fact.is_some_and(|fact| fact.successful_day_keys.contains(day))
                    })
                })
                .cloned()
                .collect();
            verbs.push(MeadowVerb {
                verb: verb.clone(),
                group,
                silhouette,
                palette,
                stage,
                tenses: states,
                butterfly_day_keys,
            });
        }
    }
    let butterflies_this_week = verbs
        .iter()
        .map(|verb| verb.butterfly_day_keys.len() as i64)
        .sum();
    let thirst = derive_thirst(input, &known);
    MeadowProgress {
        verbs,
        butterflies_this_week,
        thirst,
    }
}

fn derive_thirst(input: &MeadowInput, known: &[(String, VerbGroup)]) -> Option<MeadowThirst> {
    let (first, _) = known.first()?;
    let seen: Vec<(&String, String)> = known
        .iter()
        .filter_map(|(verb, _)| Some((verb, last_reviewed(input.snapshot, verb)?)))
        .collect();
    let latest = seen.iter().map(|(_, day)| day).max();
    match latest {
        None => Some(MeadowThirst {
            verb: first.clone(),
            days_since: 0,
        }),
        Some(latest) if days_between(latest, input.today_key) >= MEADOW_THIRST_DAYS => {
            let (verb, day) = seen
                .iter()
                .min_by(|left, right| left.1.cmp(&right.1))
                .expect("a verb was seen");
            Some(MeadowThirst {
                verb: (*verb).clone(),
                days_since: days_between(day, input.today_key),
            })
        }
        Some(_) => None,
    }
}

/// The verb a session brought a butterfly to: the one with at least three correct answers at
/// conjugation keys, the most answered if several.
pub fn meadow_visit(attempts: &[AttemptEvent]) -> Option<String> {
    let mut counts: Vec<(String, usize)> = Vec::new();
    for attempt in attempts.iter().filter(|attempt| attempt.correct) {
        let Some((verb, _)) = crate::conjugation::parse_key(&attempt.fact_key) else {
            continue;
        };
        match counts.iter_mut().find(|(known, _)| known == verb) {
            Some((_, count)) => *count += 1,
            None => counts.push((verb.to_owned(), 1)),
        }
    }
    counts
        .into_iter()
        .filter(|(_, count)| *count >= MEADOW_VISIT_ANSWERS)
        .fold(
            None,
            |best: Option<(String, usize)>, candidate| match best {
                Some(best) if best.1 >= candidate.1 => Some(best),
                _ => Some(candidate),
            },
        )
        .map(|(verb, _)| verb)
}

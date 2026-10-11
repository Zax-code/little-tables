//! The verb meadow: one flower per ticked verb, a butterfly life cycle on each, and the thirst that
//! invites the child back to conjugation (`docs/conjugation/PRE_DES_VERBES.md`).
//!
//! Everything is derived from the snapshot and the parent's settings; nothing is stored.

use serde::Serialize;

use crate::conjugation::VerbGroup;
use crate::day_key::days_between;
use crate::model::{AttemptEvent, ConjugationSettings, LearningSnapshot, MasteryState, Tense};

/// Days without conjugation after which the verbs are thirsty.
pub const MEADOW_THIRST_DAYS: i64 = 3;
/// The first day the life cycles count: the butterflies of the earlier meadow flew away.
pub const MEADOW_CYCLE_START: &str = "2026-10-10";
/// Worked days of a cycle that make the chrysalis: eggs, caterpillar, big caterpillar, chrysalis.
pub const MEADOW_CHRYSALIS_DAYS: usize = 4;
/// Calendar days a chrysalis waits before the next worked day lets its butterfly out.
pub const MEADOW_CHRYSALIS_WAIT: i64 = 3;

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

/// Where a verb's current life cycle stands.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MeadowLife {
    Empty,
    Eggs,
    Caterpillar,
    BigCaterpillar,
    Chrysalis,
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MeadowSpecies {
    Brimstone,
    Peacock,
    CommonBlue,
    CabbageWhite,
    RedAdmiral,
    Swallowtail,
}

pub const MEADOW_SPECIES: [MeadowSpecies; 6] = [
    MeadowSpecies::Brimstone,
    MeadowSpecies::Peacock,
    MeadowSpecies::CommonBlue,
    MeadowSpecies::CabbageWhite,
    MeadowSpecies::RedAdmiral,
    MeadowSpecies::Swallowtail,
];

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeadowButterfly {
    pub species: MeadowSpecies,
    /// The day it came out of its chrysalis.
    pub day_key: String,
}

/// A verb's life cycles: the butterflies already out, then the one on its way.
#[derive(Clone, Debug, PartialEq)]
pub struct MeadowCycle {
    pub life: MeadowLife,
    pub butterflies: Vec<MeadowButterfly>,
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
    /// The current life cycle on the flower.
    pub life: MeadowLife,
    /// The butterflies that came out on the verb, oldest first. They stay.
    pub butterflies: Vec<MeadowButterfly>,
    /// The latest day with a correct answer on the verb, at any tense.
    pub last_worked_day_key: Option<String>,
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
    /// Every butterfly of the meadow.
    pub butterflies: i64,
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

/// The days with a correct answer on the verb, at any tense, in order.
fn worked_days(snapshot: &LearningSnapshot, verb: &str) -> Vec<String> {
    let mut days: Vec<String> = Tense::ALL
        .into_iter()
        .filter_map(|tense| snapshot.facts.get(&crate::conjugation::key(verb, tense)))
        .flat_map(|fact| fact.successful_day_keys.iter().cloned())
        .collect();
    days.sort();
    days.dedup();
    days
}

/// The species of a butterfly, drawn from the verb and its day; never twice in a row on a verb.
fn species_of(verb: &str, day_key: &str, previous: Option<MeadowSpecies>) -> MeadowSpecies {
    let index = verb_hash(&format!("{verb}:{day_key}")) as usize % MEADOW_SPECIES.len();
    let species = MEADOW_SPECIES[index];
    if previous == Some(species) {
        MEADOW_SPECIES[(index + 1) % MEADOW_SPECIES.len()]
    } else {
        species
    }
}

/// The life cycles of a verb from its worked days, in order. From [`MEADOW_CYCLE_START`], each
/// worked day moves the cycle one step until the chrysalis; the first worked day at least
/// [`MEADOW_CHRYSALIS_WAIT`] days after it lets the butterfly out, and the next one lays eggs again.
pub fn verb_cycle(verb: &str, days: &[String]) -> MeadowCycle {
    let mut butterflies: Vec<MeadowButterfly> = Vec::new();
    let mut steps = 0;
    let mut chrysalis: Option<&str> = None;
    for day in days.iter().filter(|day| day.as_str() >= MEADOW_CYCLE_START) {
        match chrysalis {
            Some(formed) if days_between(formed, day) >= MEADOW_CHRYSALIS_WAIT => {
                let previous = butterflies.last().map(|butterfly| butterfly.species);
                butterflies.push(MeadowButterfly {
                    species: species_of(verb, day, previous),
                    day_key: day.clone(),
                });
                steps = 0;
                chrysalis = None;
            }
            Some(_) => {}
            None => {
                steps += 1;
                if steps == MEADOW_CHRYSALIS_DAYS {
                    chrysalis = Some(day);
                }
            }
        }
    }
    let life = match steps {
        0 => MeadowLife::Empty,
        1 => MeadowLife::Eggs,
        2 => MeadowLife::Caterpillar,
        3 => MeadowLife::BigCaterpillar,
        _ => MeadowLife::Chrysalis,
    };
    MeadowCycle { life, butterflies }
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
            butterflies: 0,
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
            let days = worked_days(input.snapshot, verb);
            let cycle = verb_cycle(verb, &days);
            verbs.push(MeadowVerb {
                verb: verb.clone(),
                group,
                silhouette,
                palette,
                stage,
                tenses: states,
                life: cycle.life,
                butterflies: cycle.butterflies,
                last_worked_day_key: days.last().cloned(),
            });
        }
    }
    let butterflies = verbs.iter().map(|verb| verb.butterflies.len() as i64).sum();
    let thirst = derive_thirst(input, &known);
    MeadowProgress {
        verbs,
        butterflies,
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

/// What a session changed in the meadow: a verb's next step, or a butterfly out of its chrysalis.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeadowChange {
    pub verb: String,
    /// The verb's life cycle after the session; `empty` when the butterfly just came out.
    pub life: MeadowLife,
    pub butterfly: Option<MeadowButterfly>,
}

/// The change a session brought to the verbs it asked: a new butterfly first, then the furthest
/// step, the first verb asked on a tie. `None` when no cycle moved, as on a second session the
/// same day.
pub fn meadow_change(
    attempts: &[AttemptEvent],
    before: &LearningSnapshot,
    after: &LearningSnapshot,
) -> Option<MeadowChange> {
    let mut verbs: Vec<&str> = Vec::new();
    for attempt in attempts {
        if let Some((verb, _)) = crate::conjugation::parse_key(&attempt.fact_key)
            && !verbs.contains(&verb)
        {
            verbs.push(verb);
        }
    }
    let mut best: Option<(usize, MeadowChange)> = None;
    for verb in verbs {
        let old = verb_cycle(verb, &worked_days(before, verb));
        let new = verb_cycle(verb, &worked_days(after, verb));
        let butterfly = (new.butterflies.len() > old.butterflies.len())
            .then(|| new.butterflies.last().cloned())
            .flatten();
        let rank = match &butterfly {
            Some(_) => MeadowLife::Chrysalis as usize + 1,
            None if new.life != old.life => new.life as usize,
            None => continue,
        };
        if best.as_ref().is_none_or(|(known, _)| rank > *known) {
            best = Some((
                rank,
                MeadowChange {
                    verb: verb.to_owned(),
                    life: new.life,
                    butterfly,
                },
            ));
        }
    }
    best.map(|(_, change)| change)
}

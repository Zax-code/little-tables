//! The CE2 learning paths: skill definitions, which levels are open, and the exercise generators.
//!
//! Generators draw from the session generator in exactly the order the previous engine did,
//! including the draws skipped by short-circuiting conditions. Changing the order changes the
//! questions a seed produces.

use std::collections::HashSet;
use std::sync::LazyLock;

use serde::{Deserialize, Serialize};

use crate::exercises::{
    MAX_WHOLE_NUMBER, compare_fractions, equal_option_indexes, expected_answer,
    fraction_operation_result, is_exercise_answer_correct, skill_for_key,
};
use crate::model::{
    ArithmeticBlank, ArithmeticExercise, ArithmeticOperation, ColumnExercise, ColumnOperation,
    ComparisonSymbol, ConjugationFocus, ConjugationSettings, EqualBlank, Exercise, Facts, Fraction,
    FractionCompareExercise, FractionEqualExercise, FractionLineExercise,
    FractionOperationExercise, FractionPickExercise, FractionReadExercise, LearningPathSettings,
    LineMode, MasteryState, MixedFraction, PathId, PathMode, PracticeAnswer, ReadMode, ReadShape,
    SkillId, Tense,
};
use crate::rng::{Rng, js_round};

/// Interaction families: a daily watering never mixes more than two of them.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum InteractionFamily {
    Column,
    Fractions,
    Numbers,
    /// Conjugated forms, chosen among words or written with letter tiles.
    Letters,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum LevelGate {
    All,
    Familiar,
    Seen,
}

fn state_of(facts: &Facts, key: &str) -> MasteryState {
    facts
        .get(key)
        .map_or(MasteryState::Unseen, |mastery| mastery.state)
}

fn addition_key(left: i64, right: i64) -> String {
    format!("add:{}:{}", left.min(right), left.max(right))
}

/// Pairs `1 ≤ a ≤ b ≤ 10`, by sum then by `a`.
static ADDITION_PAIRS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    let mut pairs: Vec<(i64, i64)> = (1..=10)
        .flat_map(|left| (left..=10).map(move |right| (left, right)))
        .collect();
    pairs.sort_by(|(first_left, first_right), (second_left, second_right)| {
        (first_left + first_right)
            .cmp(&(second_left + second_right))
            .then(first_left.cmp(second_left))
    });
    pairs
});

static ADDITION_KEYS: LazyLock<Vec<String>> = LazyLock::new(|| {
    ADDITION_PAIRS
        .iter()
        .map(|(left, right)| addition_key(*left, *right))
        .collect()
});

fn subtraction_keys_for(pairs: &[(i64, i64)]) -> Vec<String> {
    let mut keys: Vec<String> = Vec::new();
    for (left, right) in pairs {
        for key in [
            format!("sub:{}:{}", left + right, left),
            format!("sub:{}:{}", left + right, right),
        ] {
            if !keys.contains(&key) {
                keys.push(key);
            }
        }
    }
    keys
}

const NUMERATION_KEYS: [&str; 10] = [
    "numeration:round-100",
    "numeration:round-10",
    "numeration:step-10-100",
    "numeration:complement-100",
    "numeration:complement-1000",
    "numeration:double-half",
    "numeration:round-1000",
    "numeration:hundreds-on-thousands",
    "numeration:step-1000",
    "numeration:complement-10000",
];

const NEAR_TEN_KEYS: [&str; 12] = [
    "nearten:add:9",
    "nearten:add:19",
    "nearten:sub:9",
    "nearten:sub:19",
    "nearten:add:29",
    "nearten:add:39",
    "nearten:sub:29",
    "nearten:sub:39",
    "nearten:add:8",
    "nearten:add:18",
    "nearten:add:28",
    "nearten:add:38",
];

const COLUMN_ADDITION_KEYS: [&str; 8] = [
    "column:add:2d:carry-0",
    "column:add:2d:carry-1",
    "column:add:3d:carry-0",
    "column:add:3d:carry-1",
    "column:add:3d:carry-2",
    "column:add:3-terms",
    "column:add:4d:carry-1",
    "column:add:4d:carry-many",
];

const COLUMN_SUBTRACTION_KEYS: [&str; 8] = [
    "column:sub:2d:borrow-0",
    "column:sub:2d:borrow-1",
    "column:sub:3d:borrow-0",
    "column:sub:3d:borrow-1",
    "column:sub:3d:borrow-2",
    "column:sub:zero",
    "column:sub:4d:borrow-1",
    "column:sub:4d:borrow-many",
];

const READ_DENOMINATORS: [i64; 8] = [2, 4, 3, 8, 6, 5, 10, 12];

const EQUAL_FAMILIES: [(i64, i64); 11] = [
    (2, 4),
    (2, 8),
    (4, 8),
    (3, 6),
    (2, 6),
    (2, 10),
    (5, 10),
    (3, 12),
    (4, 12),
    (6, 12),
    (2, 12),
];

const LINE_KEYS: [&str; 9] = [
    "frac:line:2",
    "frac:line:4",
    "frac:line:10",
    "frac:line:5",
    "frac:line:3",
    "frac:line:6",
    "frac:line:8",
    "frac:line:12",
    "frac:line:mixed",
];

const COMPARE_KEYS: [&str; 3] = [
    "frac:compare:same-d",
    "frac:compare:same-n",
    "frac:compare:multiple-d",
];

const OPERATION_KEYS: [&str; 5] = [
    "frac:add:same-d",
    "frac:sub:same-d",
    "frac:complement",
    "frac:add:multiple-d",
    "frac:sub:multiple-d",
];

static READ_KEYS: LazyLock<Vec<String>> = LazyLock::new(|| {
    READ_DENOMINATORS
        .iter()
        .map(|denominator| format!("frac:read:{denominator}"))
        .collect()
});

static EQUAL_KEYS: LazyLock<Vec<String>> = LazyLock::new(|| {
    EQUAL_FAMILIES
        .iter()
        .map(|(small, large)| format!("frac:equal:{small}-{large}"))
        .collect()
});

fn owned(keys: &[&str]) -> Vec<String> {
    keys.iter().map(|key| (*key).to_owned()).collect()
}

fn any_stable(facts: &Facts, keys: &[String]) -> bool {
    keys.iter().any(|key| state_of(facts, key).is_stable())
}

/// A learning skill: its path, interaction family, how its levels open and what it weighs.
#[derive(Clone, Copy, Debug)]
pub struct SkillDefinition {
    pub family: InteractionFamily,
    gate: LevelGate,
    pub id: SkillId,
    pub path: PathId,
    pub weight: f64,
}

pub const LEARNING_SKILLS: [SkillDefinition; 11] = [
    SkillDefinition {
        family: InteractionFamily::Numbers,
        gate: LevelGate::All,
        id: SkillId::AdditionFacts,
        path: PathId::Additions,
        weight: 1.0,
    },
    SkillDefinition {
        family: InteractionFamily::Numbers,
        gate: LevelGate::All,
        id: SkillId::SubtractionFacts,
        path: PathId::Additions,
        weight: 1.0,
    },
    SkillDefinition {
        family: InteractionFamily::Numbers,
        gate: LevelGate::Familiar,
        id: SkillId::Numeration,
        path: PathId::BigNumbers,
        weight: 1.0,
    },
    SkillDefinition {
        family: InteractionFamily::Numbers,
        gate: LevelGate::Seen,
        id: SkillId::NearTen,
        path: PathId::BigNumbers,
        weight: 1.0,
    },
    SkillDefinition {
        family: InteractionFamily::Column,
        gate: LevelGate::Familiar,
        id: SkillId::ColumnAddition,
        path: PathId::BigNumbers,
        weight: 3.0,
    },
    SkillDefinition {
        family: InteractionFamily::Column,
        gate: LevelGate::Familiar,
        id: SkillId::ColumnSubtraction,
        path: PathId::BigNumbers,
        weight: 3.0,
    },
    SkillDefinition {
        family: InteractionFamily::Fractions,
        gate: LevelGate::Seen,
        id: SkillId::FractionRead,
        path: PathId::Fractions,
        weight: 1.0,
    },
    SkillDefinition {
        family: InteractionFamily::Fractions,
        gate: LevelGate::Seen,
        id: SkillId::FractionEqual,
        path: PathId::Fractions,
        weight: 1.0,
    },
    SkillDefinition {
        family: InteractionFamily::Fractions,
        gate: LevelGate::Seen,
        id: SkillId::FractionLine,
        path: PathId::Fractions,
        weight: 1.5,
    },
    SkillDefinition {
        family: InteractionFamily::Fractions,
        gate: LevelGate::Seen,
        id: SkillId::FractionCompare,
        path: PathId::Fractions,
        weight: 1.0,
    },
    SkillDefinition {
        family: InteractionFamily::Fractions,
        gate: LevelGate::Seen,
        id: SkillId::FractionOperation,
        path: PathId::Fractions,
        weight: 1.5,
    },
];

/// The conjugation skill. Its keys come from the parent's verbs (`conjugation_keys`), so it stays
/// out of `LEARNING_SKILLS` and of the maths paths' progress.
pub const CONJUGATION_SKILL: SkillDefinition = SkillDefinition {
    family: InteractionFamily::Letters,
    gate: LevelGate::All,
    id: SkillId::Conjugation,
    path: PathId::Conjugation,
    weight: 1.0,
};

/// Written conjugated forms weigh more than chosen ones (CE2 conjugation spec §6.2).
pub const WRITTEN_FORM_WEIGHT: f64 = 1.5;

/// The conjugation keys of the parent's verbs and tenses: the last verb ticked first, then the
/// tenses in teaching order. Verbs the engine cannot conjugate are left out.
pub fn conjugation_keys(settings: &ConjugationSettings) -> Vec<String> {
    let mut keys = Vec::new();
    for verb in settings.verbs.iter().rev() {
        if crate::conjugation::lookup(verb).is_none() {
            continue;
        }
        for tense in Tense::ALL {
            let key = crate::conjugation::key(verb, tense);
            if settings.tenses.contains(&tense) && !keys.contains(&key) {
                keys.push(key);
            }
        }
    }
    keys
}

/// The keys a conjugation focus puts forward: one verb, at one tense or at every ticked tense.
pub fn conjugation_focus_keys(
    settings: &ConjugationSettings,
    focus: &ConjugationFocus,
) -> Vec<String> {
    Tense::ALL
        .into_iter()
        .filter(|tense| {
            settings.tenses.contains(tense) && focus.tense.is_none_or(|only| only == *tense)
        })
        .map(|tense| crate::conjugation::key(&focus.verb, tense))
        .filter(|_| crate::conjugation::lookup(&focus.verb).is_some())
        .collect()
}

/// Whether a parent's settings can be stored: at most eleven maths skills (never conjugation), and
/// for conjugation at most sixty distinct verbs the engine knows, distinct tenses, and a focus on a
/// ticked verb and tense.
pub fn validate_learning_paths(settings: &LearningPathSettings) -> bool {
    let skills_valid = settings.enabled_skills.len() <= LEARNING_SKILLS.len()
        && !settings.enabled_skills.contains(&SkillId::Conjugation)
        && settings.focus_skill != Some(SkillId::Conjugation);
    let Some(conjugation) = &settings.conjugation else {
        return skills_valid;
    };
    let distinct = |values: &[String]| {
        values
            .iter()
            .enumerate()
            .all(|(index, value)| !values[..index].contains(value))
    };
    let tenses_distinct = conjugation
        .tenses
        .iter()
        .enumerate()
        .all(|(index, tense)| !conjugation.tenses[..index].contains(tense));
    let verbs_known = conjugation
        .verbs
        .iter()
        .all(|verb| crate::conjugation::lookup(verb).is_some());
    let focus_valid = conjugation.focus.as_ref().is_none_or(|focus| {
        conjugation.verbs.contains(&focus.verb)
            && focus
                .tense
                .is_none_or(|tense| conjugation.tenses.contains(&tense))
    });
    skills_valid
        && conjugation.verbs.len() <= crate::model::MAX_CONJUGATION_VERBS
        && distinct(&conjugation.verbs)
        && tenses_distinct
        && verbs_known
        && focus_valid
}

pub const LEARNING_PATH_IDS: [PathId; 3] =
    [PathId::Additions, PathId::BigNumbers, PathId::Fractions];

impl SkillDefinition {
    /// The skill's levels, in teaching order.
    pub fn keys(&self, facts: &Facts, forced: bool) -> Vec<String> {
        match self.id {
            SkillId::AdditionFacts => ADDITION_KEYS.clone(),
            SkillId::SubtractionFacts => {
                let pairs: Vec<(i64, i64)> = if forced {
                    ADDITION_PAIRS.clone()
                } else {
                    ADDITION_PAIRS
                        .iter()
                        .copied()
                        .filter(|(left, right)| {
                            state_of(facts, &addition_key(*left, *right)) == MasteryState::Fluent
                        })
                        .collect()
                };
                subtraction_keys_for(&pairs)
            }
            SkillId::Numeration => owned(&NUMERATION_KEYS),
            SkillId::NearTen => owned(&NEAR_TEN_KEYS),
            SkillId::ColumnAddition => owned(&COLUMN_ADDITION_KEYS),
            SkillId::ColumnSubtraction => owned(&COLUMN_SUBTRACTION_KEYS),
            SkillId::FractionRead => READ_KEYS.clone(),
            SkillId::FractionEqual => EQUAL_KEYS.clone(),
            SkillId::FractionLine => owned(&LINE_KEYS),
            SkillId::FractionCompare => owned(&COMPARE_KEYS),
            SkillId::FractionOperation => owned(&OPERATION_KEYS),
            SkillId::Conjugation => Vec::new(),
        }
    }

    /// Whether the skill may open automatically once tables 1 to 10 are acquired.
    pub fn prerequisite(&self, facts: &Facts) -> bool {
        let stable_additions = || {
            ADDITION_KEYS
                .iter()
                .filter(|key| state_of(facts, key).is_stable())
                .count()
        };
        match self.id {
            SkillId::AdditionFacts | SkillId::Numeration | SkillId::FractionRead => true,
            SkillId::SubtractionFacts => {
                ADDITION_KEYS
                    .iter()
                    .filter(|key| state_of(facts, key) == MasteryState::Fluent)
                    .count()
                    >= 5
            }
            SkillId::NearTen => state_of(facts, NUMERATION_KEYS[0]).is_stable(),
            SkillId::ColumnAddition | SkillId::ColumnSubtraction => stable_additions() >= 28,
            SkillId::FractionEqual | SkillId::FractionCompare => any_stable(facts, &READ_KEYS),
            SkillId::FractionLine | SkillId::FractionOperation => any_stable(facts, &EQUAL_KEYS),
            SkillId::Conjugation => false,
        }
    }
}

pub fn skill_definition(id: SkillId) -> &'static SkillDefinition {
    if id == SkillId::Conjugation {
        return &CONJUGATION_SKILL;
    }
    LEARNING_SKILLS
        .iter()
        .find(|skill| skill.id == id)
        .expect("every skill has a definition")
}

pub fn skill_weight(key: &str) -> f64 {
    skill_for_key(key).map_or(1.0, |skill| skill_definition(skill).weight)
}

pub fn interaction_family(key: &str) -> InteractionFamily {
    skill_for_key(key).map_or(InteractionFamily::Numbers, |skill| {
        skill_definition(skill).family
    })
}

fn open_levels(keys: Vec<String>, gate: LevelGate, facts: &Facts) -> Vec<String> {
    if gate == LevelGate::All {
        return keys;
    }
    let mut open = Vec::new();
    for key in keys {
        let state = state_of(facts, &key);
        open.push(key);
        let passed = match gate {
            LevelGate::Seen => state != MasteryState::Unseen,
            _ => state.is_stable(),
        };
        if !passed {
            break;
        }
    }
    open
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSkill {
    pub forced: bool,
    pub id: SkillId,
    pub keys: Vec<String>,
}

/// Skills whose levels may appear in practice. In automatic mode, paths open once tables 1–10
/// are acquired and each skill then waits for its prerequisite; skills a parent switched on are
/// always open. In manual mode only the parent's selection is open.
pub fn derive_open_skills(
    facts: &Facts,
    settings: &LearningPathSettings,
    tables_acquired: bool,
) -> Vec<OpenSkill> {
    LEARNING_SKILLS
        .iter()
        .filter_map(|skill| {
            let forced = settings.enabled_skills.contains(&skill.id);
            let automatic = settings.mode == PathMode::Automatic
                && tables_acquired
                && skill.prerequisite(facts);
            if !forced && !automatic {
                return None;
            }
            let keys = open_levels(skill.keys(facts, forced), skill.gate, facts);
            (!keys.is_empty()).then_some(OpenSkill {
                forced,
                id: skill.id,
                keys,
            })
        })
        .collect()
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillProgress {
    pub familiar: i64,
    pub fluent: i64,
    pub growing: i64,
    pub id: SkillId,
    pub open: bool,
    pub open_levels: i64,
    pub prerequisite_met: bool,
    pub total: i64,
    pub unseen: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathProgress {
    pub id: PathId,
    pub open: bool,
    pub skills: Vec<SkillProgress>,
}

pub fn derive_path_progress(
    facts: &Facts,
    settings: &LearningPathSettings,
    tables_acquired: bool,
) -> Vec<PathProgress> {
    let open = derive_open_skills(facts, settings, tables_acquired);
    LEARNING_PATH_IDS
        .iter()
        .map(|path| {
            let skills: Vec<SkillProgress> = LEARNING_SKILLS
                .iter()
                .filter(|skill| skill.path == *path)
                .map(|skill| {
                    let open_skill = open.iter().find(|candidate| candidate.id == skill.id);
                    let keys =
                        skill.keys(facts, open_skill.is_some_and(|candidate| candidate.forced));
                    let states: Vec<MasteryState> =
                        keys.iter().map(|key| state_of(facts, key)).collect();
                    let count = |state: MasteryState| {
                        states.iter().filter(|value| **value == state).count() as i64
                    };
                    SkillProgress {
                        familiar: count(MasteryState::Familiar),
                        fluent: count(MasteryState::Fluent),
                        growing: count(MasteryState::Learning),
                        id: skill.id,
                        open: open_skill.is_some(),
                        open_levels: open_skill.map_or(0, |candidate| candidate.keys.len() as i64),
                        prerequisite_met: skill.prerequisite(facts),
                        total: states.len() as i64,
                        unseen: count(MasteryState::Unseen),
                    }
                })
                .collect();
            PathProgress {
                id: *path,
                open: skills.iter().any(|skill| skill.open),
                skills,
            }
        })
        .collect()
}

/* ------------------------------------------------------------------------------------------ */
/* Generators                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/// Plausible neighbours used when an exercise's own distractors run out.
fn fallback_candidates(answer: &PracticeAnswer) -> Vec<PracticeAnswer> {
    match answer {
        PracticeAnswer::Integer { value } => [1, 2, 3, 4, 5, 10]
            .iter()
            .flat_map(|offset| [value + offset, value - offset])
            .filter(|candidate| (0..=MAX_WHOLE_NUMBER).contains(candidate))
            .map(|value| PracticeAnswer::Integer { value })
            .collect(),
        PracticeAnswer::Fraction {
            denominator, whole, ..
        } => [*denominator, 2, 3, 4, 5, 6, 8, 10, 12]
            .iter()
            .flat_map(|denominator| {
                (0..=*denominator).filter_map(move |numerator| {
                    (numerator > 0 || *whole > 0).then_some(PracticeAnswer::Fraction {
                        denominator: *denominator,
                        numerator,
                        whole: *whole,
                    })
                })
            })
            .collect(),
        _ => Vec::new(),
    }
}

/// Three distinct distractors plus the answer, shuffled. Distractors never equal the answer.
fn tile_choices(
    exercise: &Exercise,
    candidates: &[PracticeAnswer],
    random: &mut Rng,
) -> Vec<PracticeAnswer> {
    let answer = expected_answer(exercise);
    let mut seen = vec![answer.clone()];
    let mut wrong: Vec<PracticeAnswer> = Vec::new();
    let mut pool = random.shuffle(candidates);
    pool.extend(fallback_candidates(&answer));
    for candidate in pool {
        if wrong.len() >= 3 {
            break;
        }
        if seen.contains(&candidate) || is_exercise_answer_correct(exercise, &candidate) {
            continue;
        }
        seen.push(candidate.clone());
        wrong.push(candidate);
    }
    let mut tiles = vec![answer];
    tiles.extend(wrong);
    random.shuffle(&tiles)
}

fn integer_candidates(value: i64, offsets: &[i64]) -> Vec<PracticeAnswer> {
    offsets
        .iter()
        .map(|offset| value + offset)
        .filter(|candidate| (0..=MAX_WHOLE_NUMBER).contains(candidate))
        .map(|value| PracticeAnswer::Integer { value })
        .collect()
}

fn fraction_candidates(values: &[(i64, i64, i64)]) -> Vec<PracticeAnswer> {
    values
        .iter()
        .filter(|(numerator, denominator, _)| {
            (1..=12).contains(denominator)
                && (0..=12).contains(numerator)
                && numerator <= denominator
        })
        .map(|(numerator, denominator, whole)| PracticeAnswer::Fraction {
            denominator: *denominator,
            numerator: *numerator,
            whole: *whole,
        })
        .collect()
}

struct Context<'a> {
    random: &'a mut Rng,
    recall: bool,
}

fn with_arithmetic_choices(
    exercise: ArithmeticExercise,
    context: &mut Context<'_>,
    offsets: &[i64],
) -> Exercise {
    let exercise = Exercise::Arithmetic(exercise);
    if context.recall {
        return exercise;
    }
    let value = match expected_answer(&exercise) {
        PracticeAnswer::Integer { value } => value,
        _ => 0,
    };
    let choices = tile_choices(
        &exercise,
        &integer_candidates(value, offsets),
        context.random,
    );
    match exercise {
        Exercise::Arithmetic(mut arithmetic) => {
            arithmetic.choices = choices;
            Exercise::Arithmetic(arithmetic)
        }
        _ => unreachable!(),
    }
}

fn arithmetic(
    skill: SkillId,
    operation: ArithmeticOperation,
    left: i64,
    right: i64,
    blank: ArithmeticBlank,
    result_first: bool,
) -> ArithmeticExercise {
    ArithmeticExercise {
        blank,
        choices: Vec::new(),
        left,
        operation,
        result_first,
        right,
        skill,
    }
}

fn key_number(key: &str, index: usize, fallback: i64) -> i64 {
    key.split(':')
        .nth(index)
        .and_then(|part| part.parse().ok())
        .unwrap_or(fallback)
}

fn generate_addition_fact(key: &str, context: &mut Context<'_>) -> Exercise {
    let first = key_number(key, 1, 1);
    let second = key_number(key, 2, 1);
    let swap = context.random.next() < 0.5;
    let draw = context.random.next();
    let blank = if draw < 0.5 {
        ArithmeticBlank::Result
    } else if draw < 0.75 {
        ArithmeticBlank::Right
    } else {
        ArithmeticBlank::Left
    };
    let result_first = blank != ArithmeticBlank::Result && context.random.next() < 0.4;
    let (left, right) = if swap {
        (second, first)
    } else {
        (first, second)
    };
    with_arithmetic_choices(
        arithmetic(
            SkillId::AdditionFacts,
            ArithmeticOperation::Add,
            left,
            right,
            blank,
            result_first,
        ),
        context,
        &[-1, 1, -2, 2, 10, -10],
    )
}

fn generate_subtraction_fact(key: &str, context: &mut Context<'_>) -> Exercise {
    let total = key_number(key, 1, 2);
    let part = key_number(key, 2, 1);
    let blank = if context.random.next() < 0.7 {
        ArithmeticBlank::Result
    } else {
        ArithmeticBlank::Right
    };
    with_arithmetic_choices(
        arithmetic(
            SkillId::SubtractionFacts,
            ArithmeticOperation::Subtract,
            total,
            part,
            blank,
            false,
        ),
        context,
        &[-1, 1, -2, 2, part, total],
    )
}

fn round_to(value: i64, step: i64) -> i64 {
    js_round(value as f64 / step as f64) as i64 * step
}

/// `Math.ceil(value / divisor) * divisor` for positive values.
fn ceil_to(value: i64, step: i64) -> i64 {
    (value as f64 / step as f64).ceil() as i64 * step
}

fn add_or_subtract(add: bool) -> ArithmeticOperation {
    if add {
        ArithmeticOperation::Add
    } else {
        ArithmeticOperation::Subtract
    }
}

fn generate_numeration(key: &str, context: &mut Context<'_>) -> Exercise {
    let add = context.random.next() < 0.55;
    const PLACE_VALUE_OFFSETS: [i64; 8] = [-1, 1, -10, 10, -100, 100, -1000, 1000];
    let numeration = |left, right, operation| {
        arithmetic(
            SkillId::Numeration,
            operation,
            left,
            right,
            ArithmeticBlank::Result,
            false,
        )
    };
    match key {
        "numeration:round-100" => {
            let random = &mut *context.random;
            let left = random.integer(if add { 1 } else { 3 }, if add { 8 } else { 9 }) * 100;
            let right = random.integer(1, if add { 10 - left / 100 } else { left / 100 - 1 }) * 100;
            with_arithmetic_choices(
                numeration(left, right, add_or_subtract(add)),
                context,
                &PLACE_VALUE_OFFSETS,
            )
        }
        "numeration:round-10" => {
            let random = &mut *context.random;
            let hundreds = random.integer(1, 9) * 100;
            let tens_left = random.integer(if add { 1 } else { 3 }, if add { 7 } else { 9 });
            let tens_right = random.integer(1, if add { 9 - tens_left } else { tens_left - 1 });
            with_arithmetic_choices(
                numeration(
                    hundreds + tens_left * 10,
                    tens_right * 10,
                    add_or_subtract(add),
                ),
                context,
                &PLACE_VALUE_OFFSETS,
            )
        }
        "numeration:step-10-100" => {
            let random = &mut *context.random;
            let step = if random.next() < 0.5 { 10 } else { 100 };
            let left = if add {
                random.integer(101, 989 - step)
            } else {
                random.integer(110 + step, 999)
            };
            with_arithmetic_choices(
                numeration(left, step, add_or_subtract(add)),
                context,
                &PLACE_VALUE_OFFSETS,
            )
        }
        "numeration:complement-100" => {
            let random = &mut *context.random;
            let to_hundred = random.next() < 0.5;
            let left = if to_hundred {
                random.integer(1, 19) * 5
            } else {
                random.integer(11, 99) * 10
            };
            let target = if to_hundred {
                100
            } else {
                ceil_to(left + 1, 100)
            };
            let result_first = random.next() < 0.3;
            with_arithmetic_choices(
                arithmetic(
                    SkillId::Numeration,
                    ArithmeticOperation::Add,
                    left,
                    target - left,
                    ArithmeticBlank::Right,
                    result_first,
                ),
                context,
                &[-10, 10, -5, 5, -100, 100],
            )
        }
        "numeration:complement-1000" => {
            let random = &mut *context.random;
            let left = random.integer(1, 19) * 50;
            let blank = if random.next() < 0.5 {
                ArithmeticBlank::Right
            } else {
                ArithmeticBlank::Left
            };
            with_arithmetic_choices(
                arithmetic(
                    SkillId::Numeration,
                    ArithmeticOperation::Add,
                    left,
                    1000 - left,
                    blank,
                    false,
                ),
                context,
                &[-50, 50, -100, 100, -10, 10],
            )
        }
        "numeration:double-half" => {
            let random = &mut *context.random;
            let double = random.next() < 0.5;
            let value = if double {
                random.pick(&[100, 150, 200, 250, 300, 400, 500, 600])
            } else {
                random.pick(&[200, 300, 400, 500, 600, 800, 1000, 1200])
            };
            let offsets: Vec<i64> = if double {
                vec![-50, 50, -100, 100, value, -value / 2]
            } else {
                vec![-50, 50, -100, 100, value * 3 / 2]
            };
            with_arithmetic_choices(
                numeration(
                    value,
                    2,
                    if double {
                        ArithmeticOperation::Double
                    } else {
                        ArithmeticOperation::Half
                    },
                ),
                context,
                &offsets,
            )
        }
        "numeration:round-1000" => {
            let random = &mut *context.random;
            let left = random.integer(if add { 1 } else { 3 }, if add { 8 } else { 9 }) * 1000;
            let right = random.integer(
                1,
                if add {
                    10 - left / 1000
                } else {
                    left / 1000 - 1
                },
            ) * 1000;
            with_arithmetic_choices(
                numeration(left, right, add_or_subtract(add)),
                context,
                &PLACE_VALUE_OFFSETS,
            )
        }
        "numeration:hundreds-on-thousands" => {
            let random = &mut *context.random;
            let thousands = random.integer(1, 9) * 1000;
            let hundreds_left = random.integer(if add { 1 } else { 3 }, if add { 7 } else { 9 });
            let hundreds_right = random.integer(
                1,
                if add {
                    9 - hundreds_left
                } else {
                    hundreds_left - 1
                },
            );
            with_arithmetic_choices(
                numeration(
                    thousands + hundreds_left * 100,
                    hundreds_right * 100,
                    add_or_subtract(add),
                ),
                context,
                &PLACE_VALUE_OFFSETS,
            )
        }
        "numeration:step-1000" => {
            let random = &mut *context.random;
            let step = random.pick(&[10, 100, 1000]);
            let left = if add {
                random.integer(1001, MAX_WHOLE_NUMBER - step - 1)
            } else {
                random.integer(1000 + step, 9999)
            };
            with_arithmetic_choices(
                numeration(left, step, add_or_subtract(add)),
                context,
                &PLACE_VALUE_OFFSETS,
            )
        }
        _ => {
            let random = &mut *context.random;
            let to_ten_thousand = random.next() < 0.5;
            let left = if to_ten_thousand {
                random.integer(1, 9) * 1000
            } else {
                round_to(random.integer(1100, 9800), 100)
            };
            let target = if to_ten_thousand {
                MAX_WHOLE_NUMBER
            } else {
                ceil_to(left + 1, 1000)
            };
            let blank = if random.next() < 0.5 {
                ArithmeticBlank::Right
            } else {
                ArithmeticBlank::Left
            };
            with_arithmetic_choices(
                arithmetic(
                    SkillId::Numeration,
                    ArithmeticOperation::Add,
                    left,
                    target - left,
                    blank,
                    false,
                ),
                context,
                &[-100, 100, -1000, 1000, -10, 10],
            )
        }
    }
}

fn generate_near_ten(key: &str, context: &mut Context<'_>) -> Exercise {
    let add = key.split(':').nth(1) == Some("add");
    let amount = key_number(key, 2, 0);
    let recall = context.recall;
    let random = &mut *context.random;
    let four_digits = recall && random.next() < 0.3;
    let left = if four_digits {
        random.integer(1000, 9900)
    } else if add {
        random.integer(100, 959)
    } else {
        random.integer(100.max(amount + 11), 999)
    };
    with_arithmetic_choices(
        arithmetic(
            SkillId::NearTen,
            add_or_subtract(add),
            left,
            amount,
            ArithmeticBlank::Result,
            false,
        ),
        context,
        &[-2, 2, -1, 1, -10, 10],
    )
}

fn digits_of(value: i64) -> Vec<i64> {
    value
        .to_string()
        .bytes()
        .rev()
        .map(|byte| i64::from(byte) - i64::from(b'0'))
        .collect()
}

/// Number of columns that carry when the terms are added in columns.
pub fn count_carries(terms: &[i64]) -> i64 {
    let width = terms
        .iter()
        .map(|term| term.to_string().len())
        .max()
        .unwrap_or(0);
    let digits: Vec<Vec<i64>> = terms.iter().map(|term| digits_of(*term)).collect();
    let mut carry = 0;
    let mut carries = 0;
    for column in 0..width {
        let total: i64 = carry
            + digits
                .iter()
                .map(|term| term.get(column).copied().unwrap_or(0))
                .sum::<i64>();
        carry = total / 10;
        if carry > 0 {
            carries += 1;
        }
    }
    carries
}

/// Number of columns that need an exchange when the second term is subtracted in columns.
pub fn count_borrows(top: i64, bottom: i64) -> i64 {
    let top_digits = digits_of(top);
    let bottom_digits = digits_of(bottom);
    let mut borrow = 0;
    let mut borrows = 0;
    for (column, top_digit) in top_digits.iter().enumerate() {
        let needed = bottom_digits.get(column).copied().unwrap_or(0) + borrow;
        borrow = i64::from(*top_digit < needed);
        borrows += borrow;
    }
    borrows
}

fn number_with_digits(random: &mut Rng, digits: u32) -> i64 {
    random.integer(10_i64.pow(digits - 1), 10_i64.pow(digits) - 1)
}

fn search_terms(
    random: &mut Rng,
    mut generate: impl FnMut(&mut Rng) -> Vec<i64>,
    accept: impl Fn(&[i64]) -> bool,
    fallback: &[i64],
) -> Vec<i64> {
    for _ in 0..400 {
        let terms = generate(random);
        if accept(&terms) {
            return terms;
        }
    }
    fallback.to_vec()
}

fn generate_column_addition(key: &str, context: &mut Context<'_>) -> Exercise {
    let level = key.strip_prefix("column:add:").unwrap_or_default();
    let random = &mut *context.random;
    let make = |random: &mut Rng, digits: u32, carries: &dyn Fn(i64) -> bool, fallback: &[i64]| {
        let limit = if digits == 4 {
            MAX_WHOLE_NUMBER
        } else {
            10_i64.pow(digits) - 1
        };
        search_terms(
            random,
            |random| {
                let first = number_with_digits(random, digits);
                let second_digits = if random.next() < 0.7 {
                    digits
                } else {
                    digits.saturating_sub(1).max(1)
                };
                vec![first, number_with_digits(random, second_digits)]
            },
            |terms| carries(count_carries(terms)) && terms.iter().sum::<i64>() <= limit,
            fallback,
        )
    };
    let terms = match level {
        "2d:carry-0" => make(random, 2, &|count| count == 0, &[42, 35]),
        "2d:carry-1" => make(random, 2, &|count| count == 1, &[47, 38]),
        "3d:carry-0" => make(random, 3, &|count| count == 0, &[245, 432]),
        "3d:carry-1" => make(random, 3, &|count| count == 1, &[245, 437]),
        "3d:carry-2" => make(random, 3, &|count| count == 2, &[368, 274]),
        "3-terms" => search_terms(
            random,
            |random| {
                vec![
                    number_with_digits(random, 2),
                    number_with_digits(random, 1),
                    number_with_digits(random, 3),
                ]
            },
            |candidate| candidate.iter().sum::<i64>() <= 999,
            &[76, 7, 568],
        ),
        "4d:carry-1" => make(random, 4, &|count| count == 1, &[2345, 3418]),
        _ => make(random, 4, &|count| count >= 2, &[4687, 2756]),
    };
    Exercise::Column(ColumnExercise {
        operation: ColumnOperation::Add,
        skill: SkillId::ColumnAddition,
        terms,
    })
}

fn generate_column_subtraction(key: &str, context: &mut Context<'_>) -> Exercise {
    let level = key.strip_prefix("column:sub:").unwrap_or_default();
    let random = &mut *context.random;
    let make = |random: &mut Rng, digits: u32, borrows: &dyn Fn(i64) -> bool, fallback: &[i64]| {
        search_terms(
            random,
            |random| {
                let top = number_with_digits(random, digits);
                let bottom_digits = if random.next() < 0.7 {
                    digits
                } else {
                    digits.saturating_sub(1).max(1)
                };
                vec![top, number_with_digits(random, bottom_digits)]
            },
            |terms| terms[0] > terms[1] && borrows(count_borrows(terms[0], terms[1])),
            fallback,
        )
    };
    let terms = match level {
        "2d:borrow-0" => make(random, 2, &|count| count == 0, &[68, 25]),
        "2d:borrow-1" => make(random, 2, &|count| count == 1, &[62, 37]),
        "3d:borrow-0" => make(random, 3, &|count| count == 0, &[586, 243]),
        "3d:borrow-1" => make(random, 3, &|count| count == 1, &[574, 239]),
        "3d:borrow-2" => make(random, 3, &|count| count == 2, &[523, 167]),
        "zero" => search_terms(
            random,
            |random| {
                if random.next() < 0.6 {
                    let hundreds = random.integer(1, 9) * 100;
                    let units = random.integer(1, 9);
                    vec![hundreds + units, number_with_digits(random, 3)]
                } else {
                    let thousands = random.integer(2, 9) * 1000;
                    vec![thousands, number_with_digits(random, 4)]
                }
            },
            |terms| terms[0] > terms[1] && count_borrows(terms[0], terms[1]) >= 2,
            &[503, 128],
        ),
        "4d:borrow-1" => make(random, 4, &|count| count == 1, &[5847, 2394]),
        _ => make(random, 4, &|count| count >= 2, &[6132, 2758]),
    };
    Exercise::Column(ColumnExercise {
        operation: ColumnOperation::Subtract,
        skill: SkillId::ColumnSubtraction,
        terms,
    })
}

fn generate_fraction_read(key: &str, context: &mut Context<'_>) -> Exercise {
    let denominator = key_number(key, 2, 2);
    let random = &mut *context.random;
    let numerator = if denominator == 2 {
        1
    } else {
        random.integer(1, denominator - 1)
    };
    let shape = if denominator <= 8 && random.next() < 0.35 {
        ReadShape::Pot
    } else {
        ReadShape::Bed
    };
    let fraction = Fraction {
        denominator,
        numerator,
    };
    if context.recall {
        let mode = if context.random.next() < 0.45 {
            ReadMode::Build
        } else {
            ReadMode::Read
        };
        return Exercise::FractionRead(FractionReadExercise {
            choices: Vec::new(),
            fraction,
            mode,
            shape,
            skill: SkillId::FractionRead,
        });
    }
    let mut read = FractionReadExercise {
        choices: Vec::new(),
        fraction,
        mode: ReadMode::Read,
        shape,
        skill: SkillId::FractionRead,
    };
    let empty = denominator - numerator;
    let candidates = fraction_candidates(&[
        (empty, denominator, 0),
        (numerator, empty, 0),
        (numerator + 1, denominator, 0),
        (numerator - 1, denominator, 0),
        (numerator, denominator + 1, 0),
        (numerator, denominator - 1, 0),
    ]);
    read.choices = tile_choices(
        &Exercise::FractionRead(read.clone()),
        &candidates,
        context.random,
    );
    Exercise::FractionRead(read)
}

fn pick_options_for(reference: Fraction, random: &mut Rng) -> Vec<Fraction> {
    let mut equal: Vec<Fraction> = Vec::new();
    let mut denominator = reference.denominator * 2;
    while denominator <= 12 {
        equal.push(Fraction {
            denominator,
            numerator: (reference.numerator * denominator) / reference.denominator,
        });
        denominator += reference.denominator;
    }
    let chosen_equal: Vec<Fraction> = random
        .shuffle(&equal)
        .into_iter()
        .take(equal.len().min(2))
        .collect();
    let mut options = chosen_equal.clone();
    let mut pool: Vec<Fraction> = chosen_equal
        .iter()
        .flat_map(|fraction| {
            [
                Fraction {
                    denominator: fraction.denominator,
                    numerator: fraction.numerator + 1,
                },
                Fraction {
                    denominator: fraction.denominator,
                    numerator: fraction.numerator - 1,
                },
                Fraction {
                    denominator: fraction.denominator,
                    numerator: reference.numerator,
                },
            ]
        })
        .collect();
    pool.push(Fraction {
        denominator: reference.denominator,
        numerator: reference.numerator + 1,
    });
    pool.push(Fraction {
        denominator: reference.denominator + 1,
        numerator: reference.numerator,
    });
    let candidates = random.shuffle(&pool);
    for candidate in candidates {
        if options.len() >= 5.min(chosen_equal.len() + 3) {
            break;
        }
        if candidate.numerator < 1 || candidate.numerator > candidate.denominator {
            continue;
        }
        if candidate.denominator > 12 {
            continue;
        }
        if compare_fractions(candidate, reference) == ComparisonSymbol::Equal {
            continue;
        }
        if options
            .iter()
            .any(|option| compare_fractions(*option, candidate) == ComparisonSymbol::Equal)
        {
            continue;
        }
        options.push(candidate);
    }
    random.shuffle(&options)
}

fn generate_fraction_equal(key: &str, context: &mut Context<'_>) -> Exercise {
    let pair = key.split(':').nth(2).unwrap_or("2-4");
    let mut sides = pair.split('-').map(|side| side.parse::<i64>().ok());
    let small = sides.next().flatten().unwrap_or(2);
    let large = sides.next().flatten().unwrap_or(4);
    let scale = large / small;
    let numerator = context.random.integer(1, small - 1);
    let small_fraction = Fraction {
        denominator: small,
        numerator,
    };
    let large_fraction = Fraction {
        denominator: large,
        numerator: numerator * scale,
    };
    if context.recall && context.random.next() < 0.35 {
        let pick = FractionPickExercise {
            options: pick_options_for(small_fraction, context.random),
            reference: small_fraction,
            skill: SkillId::FractionEqual,
        };
        if !equal_option_indexes(&pick).is_empty() && pick.options.len() >= 3 {
            return Exercise::FractionPick(pick);
        }
    }
    let forward = context.random.next() < 0.7;
    let blank = if context.random.next() < 0.75 {
        EqualBlank::Numerator
    } else {
        EqualBlank::Denominator
    };
    let mut equal = FractionEqualExercise {
        blank,
        choices: Vec::new(),
        known: if forward {
            small_fraction
        } else {
            large_fraction
        },
        skill: SkillId::FractionEqual,
        target: if forward {
            large_fraction
        } else {
            small_fraction
        },
    };
    if context.recall {
        return Exercise::FractionEqual(equal);
    }
    let side = |fraction: Fraction| match blank {
        EqualBlank::Numerator => fraction.numerator,
        EqualBlank::Denominator => fraction.denominator,
    };
    let answer = side(equal.target);
    let mut candidates = integer_candidates(answer, &[-1, 1, 2, -2]);
    candidates.extend(integer_candidates(
        0,
        &[side(equal.known), scale, answer * scale],
    ));
    equal.choices = tile_choices(
        &Exercise::FractionEqual(equal.clone()),
        &candidates,
        context.random,
    );
    Exercise::FractionEqual(equal)
}

fn generate_fraction_line(key: &str, context: &mut Context<'_>) -> Exercise {
    let level = key.split(':').nth(2).unwrap_or("2");
    let mixed = level == "mixed";
    let recall = context.recall;
    let random = &mut *context.random;
    let denominator = if mixed {
        random.pick(&[2, 4, 5, 10])
    } else {
        level.parse().unwrap_or(2)
    };
    let finer_ticks: Vec<i64> = [12, 10, 8]
        .into_iter()
        .filter(|ticks| *ticks != denominator && ticks % denominator == 0)
        .collect();
    let ticks = if !mixed && recall && !finer_ticks.is_empty() && random.next() < 0.35 {
        random.pick(&finer_ticks)
    } else {
        denominator
    };
    let target = if mixed {
        MixedFraction {
            denominator,
            numerator: random.integer(1, denominator - 1),
            whole: 1,
        }
    } else {
        MixedFraction {
            denominator,
            numerator: random.integer(1, denominator),
            whole: 0,
        }
    };
    let target = if target.numerator == target.denominator {
        MixedFraction {
            denominator,
            numerator: 0,
            whole: target.whole + 1,
        }
    } else {
        target
    };
    let mode = if recall && random.next() < 0.6 {
        LineMode::Place
    } else {
        LineMode::Read
    };
    let mut line = FractionLineExercise {
        choices: Vec::new(),
        mode,
        skill: SkillId::FractionLine,
        target,
        ticks,
        units: if mixed { 2 } else { 1 },
    };
    if recall || mode == LineMode::Place {
        return Exercise::FractionLine(line);
    }
    let MixedFraction {
        numerator, whole, ..
    } = target;
    let candidates = fraction_candidates(&[
        (numerator + 1, denominator, whole),
        ((numerator - 1).max(0), denominator, whole),
        (denominator - numerator, denominator, whole),
        (numerator, denominator + 1, whole),
        (numerator, denominator, if whole == 0 { 1 } else { 0 }),
    ]);
    line.choices = tile_choices(
        &Exercise::FractionLine(line.clone()),
        &candidates,
        context.random,
    );
    Exercise::FractionLine(line)
}

fn generate_fraction_compare(key: &str, context: &mut Context<'_>) -> Exercise {
    let level = key.split(':').nth(2).unwrap_or_default();
    let random = &mut *context.random;
    let compare = |left, right| {
        Exercise::FractionCompare(FractionCompareExercise {
            left,
            right,
            skill: SkillId::FractionCompare,
        })
    };
    if level == "same-d" {
        let denominator = random.integer(3, 12);
        let first = random.integer(1, denominator - 1);
        let mut second = random.integer(1, denominator - 1);
        if second == first {
            second = if first == 1 { 2 } else { first - 1 };
        }
        return compare(
            Fraction {
                denominator,
                numerator: first,
            },
            Fraction {
                denominator,
                numerator: second,
            },
        );
    }
    if level == "same-n" {
        let numerator = random.integer(1, 5);
        let first = random.integer(numerator + 1, 12);
        let mut second = random.integer(numerator + 1, 12);
        if second == first {
            second = if first == 12 { 11 } else { first + 1 };
        }
        return compare(
            Fraction {
                denominator: first,
                numerator,
            },
            Fraction {
                denominator: second,
                numerator,
            },
        );
    }
    let (small, large) = random.pick(&EQUAL_FAMILIES);
    let scale = large / small;
    let small_numerator = random.integer(1, small - 1);
    let large_numerator = if random.next() < 0.25 {
        small_numerator * scale
    } else {
        let options: Vec<i64> = [small_numerator * scale - 1, small_numerator * scale + 1]
            .into_iter()
            .filter(|value| *value >= 1 && *value < large)
            .collect();
        random.pick(&options)
    };
    let small_first = random.next() < 0.5;
    let small_fraction = Fraction {
        denominator: small,
        numerator: small_numerator,
    };
    let large_fraction = Fraction {
        denominator: large,
        numerator: large_numerator,
    };
    if small_first {
        compare(small_fraction, large_fraction)
    } else {
        compare(large_fraction, small_fraction)
    }
}

fn generate_fraction_operation(key: &str, context: &mut Context<'_>) -> Exercise {
    let random = &mut *context.random;
    let operation_of = |add: bool| {
        if add {
            ColumnOperation::Add
        } else {
            ColumnOperation::Subtract
        }
    };
    let make = |left, operation, right, story| FractionOperationExercise {
        choices: Vec::new(),
        left,
        operation,
        right,
        skill: SkillId::FractionOperation,
        story,
    };
    let mut exercise = if key == "frac:add:same-d" || key == "frac:sub:same-d" {
        let denominator = random.integer(3, 12);
        let add = key == "frac:add:same-d";
        let first = if add {
            random.integer(1, denominator - 1)
        } else {
            random.integer(2, denominator)
        };
        let second = if add {
            random.integer(1, denominator - first)
        } else {
            random.integer(1, first - 1)
        };
        make(
            Fraction {
                denominator,
                numerator: first,
            },
            operation_of(add),
            Fraction {
                denominator,
                numerator: second,
            },
            false,
        )
    } else if key == "frac:complement" {
        let denominator = random.integer(3, 12);
        let right = random.integer(1, denominator - 1);
        let story = random.next() < 0.5;
        make(
            Fraction {
                denominator,
                numerator: denominator,
            },
            ColumnOperation::Subtract,
            Fraction {
                denominator,
                numerator: right,
            },
            story,
        )
    } else {
        let (small, large) = random.pick(&EQUAL_FAMILIES);
        let scale = large / small;
        let add = key == "frac:add:multiple-d";
        let small_numerator = random.integer(1, small - 1);
        let scaled_small = small_numerator * scale;
        let large_numerator = if add {
            random.integer(1, (large - scaled_small).max(1))
        } else {
            random.integer(1, (scaled_small - 1).max(1))
        };
        let small_fraction = Fraction {
            denominator: small,
            numerator: small_numerator,
        };
        let large_fraction = Fraction {
            denominator: large,
            numerator: large_numerator,
        };
        let small_first = !add || random.next() < 0.5;
        let candidate = if small_first {
            make(small_fraction, operation_of(add), large_fraction, false)
        } else {
            make(large_fraction, operation_of(add), small_fraction, false)
        };
        let result = fraction_operation_result(&candidate);
        if result.numerator < 0 || result.numerator > result.denominator {
            let quarter = Fraction {
                denominator: 4,
                numerator: 1,
            };
            let half = Fraction {
                denominator: 2,
                numerator: 1,
            };
            if add {
                make(quarter, ColumnOperation::Add, half, false)
            } else {
                make(half, ColumnOperation::Subtract, quarter, false)
            }
        } else {
            candidate
        }
    };
    if context.recall {
        return Exercise::FractionOperation(exercise);
    }
    let result = fraction_operation_result(&exercise);
    let (left, right) = (exercise.left, exercise.right);
    let candidates = fraction_candidates(&[
        (
            left.numerator + right.numerator,
            left.denominator + right.denominator,
            0,
        ),
        (
            (left.numerator - right.numerator).abs(),
            (left.denominator - right.denominator).abs(),
            0,
        ),
        (result.numerator + 1, result.denominator, 0),
        ((result.numerator - 1).max(0), result.denominator, 0),
        (result.numerator, left.denominator.min(right.denominator), 0),
    ]);
    exercise.choices = tile_choices(
        &Exercise::FractionOperation(exercise.clone()),
        &candidates,
        context.random,
    );
    Exercise::FractionOperation(exercise)
}

/// Builds one exercise for a skill level. Recall asks the learner to produce the answer.
pub fn generate_exercise(key: &str, random: &mut Rng, recall: bool) -> Option<Exercise> {
    if skill_for_key(key)? == SkillId::Conjugation {
        return crate::conjugation::exercise::generate(key, random, recall);
    }
    let mut context = Context { random, recall };
    let context = &mut context;
    Some(match skill_for_key(key)? {
        SkillId::AdditionFacts => generate_addition_fact(key, context),
        SkillId::SubtractionFacts => generate_subtraction_fact(key, context),
        SkillId::Numeration => generate_numeration(key, context),
        SkillId::NearTen => generate_near_ten(key, context),
        SkillId::ColumnAddition => generate_column_addition(key, context),
        SkillId::ColumnSubtraction => generate_column_subtraction(key, context),
        SkillId::FractionRead => generate_fraction_read(key, context),
        SkillId::FractionEqual => generate_fraction_equal(key, context),
        SkillId::FractionLine => generate_fraction_line(key, context),
        SkillId::FractionCompare => generate_fraction_compare(key, context),
        SkillId::FractionOperation => generate_fraction_operation(key, context),
        SkillId::Conjugation => return None,
    })
}

/// Every level key of every skill, subtraction levels included for every addition pair.
pub fn all_level_keys() -> Vec<String> {
    let facts = Facts::new();
    LEARNING_SKILLS
        .iter()
        .flat_map(|skill| skill.keys(&facts, true))
        .collect()
}

#[allow(dead_code)]
fn unique(keys: &[String]) -> usize {
    keys.iter().collect::<HashSet<_>>().len()
}

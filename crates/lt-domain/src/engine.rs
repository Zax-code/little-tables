//! Mastery, sessions and answers: the learning engine proper.

use std::cmp::Ordering;
use std::sync::LazyLock;

use indexmap::IndexSet;
use serde::{Deserialize, Serialize};

use crate::day_key::DayKeys;
use crate::exercises::{
    expected_answer, is_exercise_answer_correct, is_exercise_well_formed, is_production_exercise,
    skill_for_key,
};
use crate::model::{
    AnswerMode, AttemptEvent, CurriculumPack, CurriculumPolicy, Exercise, FactMastery, Facts,
    LearningPathSettings, LearningSnapshot, MasteryState, Millis, PracticeAnswer, PracticePolicy,
    PracticeQuestion, PracticeSession, QuestionOperation, SessionKind, SkillId,
};
use crate::paths::{
    InteractionFamily, PathProgress, WRITTEN_FORM_WEIGHT, conjugation_focus_keys, conjugation_keys,
    derive_open_skills, derive_path_progress, generate_exercise, interaction_family,
    skill_definition, skill_weight,
};
use crate::rng::{Rng, js_round};

const WEAK_FACT_DIFFICULTY: f64 = 0.53;
const CHOICE_RECALL_STABILITY_FACTOR: f64 = 1.5;
const KEYPAD_RECALL_STABILITY_FACTOR: f64 = 2.0;

const INITIAL_FACTS: [(i64, i64); 12] = [
    (2, 2),
    (2, 5),
    (5, 5),
    (2, 10),
    (5, 10),
    (3, 3),
    (3, 4),
    (4, 5),
    (3, 5),
    (4, 4),
    (2, 3),
    (2, 4),
];

/// The 55 facts of tables 1 to 10, gentlest first.
pub static CORE_FACTS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    let mut facts: Vec<(i64, i64)> = Vec::new();
    let all = INITIAL_FACTS
        .iter()
        .copied()
        .chain((1..=10).flat_map(|left| (left..=10).map(move |right| (left, right))));
    for fact in all {
        if !facts.contains(&fact) {
            facts.push(fact);
        }
    }
    facts
});

/// Tables 11 and 12, with duplicates kept as listed.
pub static BONUS_FACTS: LazyLock<Vec<(i64, i64)>> = LazyLock::new(|| {
    (1..=11)
        .map(|left| (left, 11))
        .chain((1..=12).map(|left| (left, 12)))
        .collect()
});

pub fn canonical_fact_key(left: i64, right: i64) -> String {
    format!("{}:{}", left.min(right), left.max(right))
}

pub fn fact_key(left: i64, operation: QuestionOperation, right: i64) -> String {
    match operation {
        QuestionOperation::Multiply => canonical_fact_key(left, right),
        QuestionOperation::Divide => format!("divide:{left}:{right}"),
    }
}

/// `^\d+:\d+$`: a multiplication fact key.
fn is_multiplication_key(key: &str) -> bool {
    let mut parts = key.split(':');
    let digits = |part: Option<&str>| {
        part.is_some_and(|value| {
            !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit())
        })
    };
    digits(parts.next()) && digits(parts.next()) && parts.next().is_none()
}

/// The numeric answer to a fact or to an exercise whose answer is a whole number. Exercises
/// answered with a fraction, a comparison, a graduation or a selection return 0.
pub fn correct_answer(question: &PracticeQuestion) -> i64 {
    correct_answer_for(
        question.exercise.as_ref(),
        question.left,
        question.operation,
        question.right,
    )
}

fn correct_answer_for(
    exercise: Option<&Exercise>,
    left: i64,
    operation: QuestionOperation,
    right: i64,
) -> i64 {
    if let Some(exercise) = exercise {
        return match expected_answer(exercise) {
            PracticeAnswer::Integer { value } => value,
            _ => 0,
        };
    }
    match operation {
        QuestionOperation::Multiply => left * right,
        QuestionOperation::Divide => {
            assert!(
                right != 0 && left % right == 0,
                "Division questions require a non-zero divisor and an integer answer"
            );
            left / right
        }
    }
}

/// Recall slower than this marks a fact as weak. Generated exercises are never timed.
pub(crate) fn latency_limit_ms(key: &str) -> Option<f64> {
    if is_multiplication_key(key) || key.starts_with("divide:") {
        Some(3_000.0)
    } else if key.starts_with("add:") || key.starts_with("sub:") {
        // The CE2 target is fifteen addition facts in one minute, about four seconds each.
        Some(4_000.0)
    } else {
        None
    }
}

fn is_slow(key: &str, latency_ms: Option<f64>) -> bool {
    matches!((latency_limit_ms(key), latency_ms), (Some(limit), Some(latency)) if latency > limit)
}

fn choices_for(left: i64, operation: QuestionOperation, right: i64, random: &mut Rng) -> Vec<i64> {
    let answer = correct_answer_for(None, left, operation, right);
    let candidates: Vec<i64> = match operation {
        QuestionOperation::Multiply => vec![
            answer,
            left * (right - 1).max(1),
            left * (right + 1).min(12),
            right * (left - 1).max(1),
            right * (left + 1).min(12),
            answer - left,
            answer + right,
            answer + 2,
            (answer - 2).max(0),
        ],
        QuestionOperation::Divide => vec![
            answer,
            (answer - 1).max(0),
            answer + 1,
            right,
            answer + 2,
            (answer - 2).max(0),
        ],
    };
    let mut distinct: Vec<i64> = Vec::new();
    for candidate in candidates.into_iter().filter(|candidate| *candidate >= 0) {
        if !distinct.contains(&candidate) {
            distinct.push(candidate);
        }
    }
    let mut fallback = 1;
    while distinct.len() < 4 {
        if !distinct.contains(&fallback) {
            distinct.push(fallback);
        }
        fallback += 1;
    }
    let wrong: Vec<i64> = random
        .shuffle(
            &distinct
                .into_iter()
                .filter(|candidate| *candidate != answer)
                .collect::<Vec<_>>(),
        )
        .into_iter()
        .take(3)
        .collect();
    let mut tiles = vec![answer];
    tiles.extend(wrong);
    random.shuffle(&tiles)
}

pub fn empty_snapshot() -> LearningSnapshot {
    LearningSnapshot::default()
}

/// `new Date(at + days * 24 * 60 * 60 * 1000)`: fractional milliseconds are truncated.
fn add_days(at: Millis, days: f64) -> Millis {
    (at as f64 + days * 24.0 * 60.0 * 60.0 * 1000.0).trunc() as Millis
}

fn mastery_state(
    key: &str,
    correct_count: i64,
    successful_days: usize,
    recall_days: usize,
    current: MasteryState,
) -> MasteryState {
    // Comparing fractions is always answered with three tiles, so recall evidence never exists.
    // Five separate successful days replace it.
    if key.starts_with("frac:compare:") {
        if successful_days >= 5 {
            return MasteryState::Fluent;
        }
    } else if correct_count >= 5 && successful_days >= 3 && recall_days >= 2 {
        return MasteryState::Fluent;
    }
    if correct_count >= 3 && successful_days >= 2 {
        return MasteryState::Familiar;
    }
    if correct_count > 0 || current != MasteryState::Unseen {
        return MasteryState::Learning;
    }
    MasteryState::Unseen
}

fn with_day(keys: &[String], day_key: &str) -> Vec<String> {
    let mut result = Vec::with_capacity(keys.len() + 1);
    for key in keys.iter().map(String::as_str).chain([day_key]) {
        if !result.iter().any(|existing: &String| existing == key) {
            result.push(key.to_owned());
        }
    }
    result
}

fn update_mastery(
    current: &FactMastery,
    attempt: &AttemptEvent,
    time_zone: &str,
    day_keys: &dyn DayKeys,
) -> FactMastery {
    let day_key = attempt
        .learning_day_key
        .clone()
        .unwrap_or_else(|| day_keys.day_key(attempt.answered_at, time_zone));
    let is_new_successful_day = attempt.correct && !current.successful_day_keys.contains(&day_key);
    let successful_day_keys = if attempt.correct {
        with_day(&current.successful_day_keys, &day_key)
    } else {
        current.successful_day_keys.clone()
    };
    let recall_day_keys = if attempt.correct && attempt.answer_mode == AnswerMode::Keypad {
        with_day(&current.recall_day_keys, &day_key)
    } else {
        current.recall_day_keys.clone()
    };
    // Durable mastery advances at most once per local learning day. Repeating a fact can still
    // repair an error and reinforce the answer, but a long same-day session is not evidence of
    // spaced recall.
    let correct_count = current.correct_count + i64::from(is_new_successful_day);
    let stability_days = if attempt.correct {
        if current.stability_days == 0.0 {
            1.0
        } else if is_new_successful_day {
            let factor = if attempt.answer_mode == AnswerMode::Keypad {
                KEYPAD_RECALL_STABILITY_FACTOR
            } else {
                CHOICE_RECALL_STABILITY_FACTOR
            };
            (current.stability_days * factor).min(60.0)
        } else {
            current.stability_days
        }
    } else {
        (current.stability_days * 0.35).max(0.0)
    };
    let state = if attempt.correct {
        mastery_state(
            &attempt.fact_key,
            correct_count,
            successful_day_keys.len(),
            recall_day_keys.len(),
            current.state,
        )
    } else if current.state == MasteryState::Fluent {
        MasteryState::Familiar
    } else {
        MasteryState::Learning
    };
    let difficulty_change = if attempt.correct {
        if is_new_successful_day { -0.02 } else { 0.0 }
    } else {
        0.08
    };

    FactMastery {
        correct_count,
        correct_streak: if attempt.correct {
            current.correct_streak + i64::from(is_new_successful_day)
        } else {
            0
        },
        difficulty: (current.difficulty + difficulty_change).clamp(0.0, 1.0),
        due_at: match current.due_at {
            Some(due_at) if attempt.correct && !is_new_successful_day => Some(due_at),
            _ => Some(add_days(attempt.answered_at, stability_days.max(0.04))),
        },
        lapse_count: current.lapse_count + i64::from(!attempt.correct),
        last_reviewed_at: Some(attempt.answered_at),
        last_reviewed_day_key: Some(day_key),
        latency_ms: if !attempt.correct || !is_new_successful_day {
            current.latency_ms
        } else {
            match current.latency_ms {
                None => Some(attempt.latency_ms),
                Some(latency) => Some(js_round(latency * 0.7 + attempt.latency_ms * 0.3)),
            }
        },
        recall_day_keys,
        stability_days,
        state,
        successful_day_keys,
    }
}

/// Applies attempts in the given order, ignoring those already processed.
pub fn reduce(
    snapshot: &LearningSnapshot,
    attempts: &[AttemptEvent],
    time_zone: &str,
    day_keys: &dyn DayKeys,
) -> LearningSnapshot {
    let mut processed: IndexSet<String> = snapshot.processed_event_ids.iter().cloned().collect();
    let mut facts = snapshot.facts.clone();
    let mut changed = false;
    for attempt in attempts {
        if processed.contains(&attempt.event_id) {
            continue;
        }
        let current = facts
            .get(&attempt.fact_key)
            .cloned()
            .unwrap_or_else(FactMastery::empty);
        let next = update_mastery(&current, attempt, time_zone, day_keys);
        facts.insert(attempt.fact_key.clone(), next);
        processed.insert(attempt.event_id.clone());
        changed = true;
    }
    if !changed {
        return snapshot.clone();
    }
    LearningSnapshot {
        algorithm_version: snapshot.algorithm_version.clone(),
        facts,
        processed_event_ids: processed.into_iter().collect(),
    }
}

/* ------------------------------------------------------------------------------------------ */
/* Curriculum and progress                                                                    */
/* ------------------------------------------------------------------------------------------ */

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum UnlockReason {
    CoreNotStable,
    NoFluentFamily,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurriculumPackUnlock {
    pub current: i64,
    pub reason: Option<UnlockReason>,
    pub required: i64,
    pub unlocked: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurriculumPackProgress {
    pub bonus1112: CurriculumPackUnlock,
    pub core: CurriculumPackUnlock,
    pub inverse_division: CurriculumPackUnlock,
}

fn state_of(facts: &Facts, key: &str) -> MasteryState {
    facts
        .get(key)
        .map_or(MasteryState::Unseen, |mastery| mastery.state)
}

pub fn derive_curriculum_pack_progress(snapshot: &LearningSnapshot) -> CurriculumPackProgress {
    let stable_core_facts = CORE_FACTS
        .iter()
        .filter(|(left, right)| {
            state_of(&snapshot.facts, &canonical_fact_key(*left, *right)).is_stable()
        })
        .count() as i64;
    let fluent_families = snapshot
        .facts
        .iter()
        .filter(|(key, mastery)| {
            is_multiplication_key(key) && mastery.state == MasteryState::Fluent
        })
        .count() as i64;
    let bonus_unlocked = stable_core_facts == CORE_FACTS.len() as i64;
    let inverse_division_unlocked = fluent_families >= 1;
    CurriculumPackProgress {
        bonus1112: CurriculumPackUnlock {
            current: stable_core_facts,
            reason: (!bonus_unlocked).then_some(UnlockReason::CoreNotStable),
            required: CORE_FACTS.len() as i64,
            unlocked: bonus_unlocked,
        },
        core: CurriculumPackUnlock {
            current: 0,
            reason: None,
            required: 0,
            unlocked: true,
        },
        inverse_division: CurriculumPackUnlock {
            current: fluent_families,
            reason: (!inverse_division_unlocked).then_some(UnlockReason::NoFluentFamily),
            required: 1,
            unlocked: inverse_division_unlocked,
        },
    }
}

#[derive(Clone, Debug)]
struct CurriculumFact {
    fact_key: String,
    left: i64,
    operation: QuestionOperation,
    right: i64,
    skill: Option<SkillId>,
    skill_index: Option<usize>,
    tables: Vec<i64>,
}

/// `String.prototype.localeCompare` for fact keys: punctuation sorts before digits.
fn locale_compare(first: &str, second: &str) -> Ordering {
    let weight = |byte: u8| if byte == b':' { b'/' } else { byte };
    first.bytes().map(weight).cmp(second.bytes().map(weight))
}

fn division_curriculum_for(snapshot: &LearningSnapshot) -> Vec<CurriculumFact> {
    let mut keys: Vec<(&String, &FactMastery)> = snapshot.facts.iter().collect();
    keys.sort_by(|(first, _), (second, _)| locale_compare(first, second));
    keys.into_iter()
        .filter(|(key, mastery)| {
            is_multiplication_key(key) && mastery.state == MasteryState::Fluent
        })
        .flat_map(|(key, _)| {
            let mut parts = key.split(':').map(|part| part.parse::<i64>().unwrap_or(0));
            let first = parts.next().unwrap_or(0);
            let second = parts.next().unwrap_or(0);
            let product = first * second;
            let divisors: Vec<i64> = if first == second {
                vec![first]
            } else {
                vec![first, second]
            };
            divisors.into_iter().map(move |divisor| CurriculumFact {
                fact_key: fact_key(product, QuestionOperation::Divide, divisor),
                left: product,
                operation: QuestionOperation::Divide,
                right: divisor,
                skill: None,
                skill_index: None,
                tables: if first == second {
                    vec![first]
                } else {
                    vec![first, second]
                },
            })
        })
        .collect()
}

fn packs_of(curriculum: Option<&CurriculumPolicy>) -> Vec<CurriculumPack> {
    curriculum
        .and_then(|curriculum| curriculum.packs.clone())
        .unwrap_or_else(|| vec![CurriculumPack::Core])
}

fn multiplication_facts(packs: &[CurriculumPack], bonus_unlocked: bool) -> Vec<(i64, i64)> {
    let mut facts = Vec::new();
    if packs.contains(&CurriculumPack::Core) {
        facts.extend(CORE_FACTS.iter().copied());
    }
    if packs.contains(&CurriculumPack::Bonus1112) && bonus_unlocked {
        facts.extend(BONUS_FACTS.iter().copied());
    }
    facts
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct FactProgressCounts {
    pub familiar: i64,
    pub fluent: i64,
    pub growing: i64,
    pub total: i64,
    pub unseen: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct TableLearningProgress {
    pub facts: FactProgressCounts,
    pub table: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningProgress {
    pub division_facts: FactProgressCounts,
    pub facts: FactProgressCounts,
    pub packs: CurriculumPackProgress,
    pub paths: Vec<PathProgress>,
    pub tables: Vec<TableLearningProgress>,
    /// The verbs a parent ticked, in the order ticked; absent without any.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub conjugation: Vec<VerbProgress>,
}

/// How rooted each ticked tense of a verb is.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct VerbProgress {
    pub group: crate::conjugation::VerbGroup,
    pub tenses: Vec<TenseProgress>,
    pub verb: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct TenseProgress {
    pub state: MasteryState,
    pub tense: crate::model::Tense,
}

fn conjugation_progress(
    snapshot: &LearningSnapshot,
    curriculum: Option<&CurriculumPolicy>,
) -> Vec<VerbProgress> {
    let Some(settings) = curriculum
        .and_then(|curriculum| curriculum.paths.as_ref())
        .and_then(|paths| paths.conjugation.as_ref())
    else {
        return Vec::new();
    };
    settings
        .verbs
        .iter()
        .filter_map(|verb| {
            let group = crate::conjugation::lookup(verb)?.group;
            Some(VerbProgress {
                group,
                tenses: crate::model::Tense::ALL
                    .into_iter()
                    .filter(|tense| settings.tenses.contains(tense))
                    .map(|tense| TenseProgress {
                        state: state_of(&snapshot.facts, &crate::conjugation::key(verb, tense)),
                        tense,
                    })
                    .collect(),
                verb: verb.clone(),
            })
        })
        .collect()
}

fn counts_for_keys(facts: &Facts, keys: &[String]) -> FactProgressCounts {
    let states: Vec<MasteryState> = keys.iter().map(|key| state_of(facts, key)).collect();
    let count = |state: MasteryState| states.iter().filter(|value| **value == state).count() as i64;
    FactProgressCounts {
        familiar: count(MasteryState::Familiar),
        fluent: count(MasteryState::Fluent),
        growing: count(MasteryState::Learning),
        total: states.len() as i64,
        unseen: count(MasteryState::Unseen),
    }
}

pub fn derive_learning_progress(
    snapshot: &LearningSnapshot,
    curriculum: Option<&CurriculumPolicy>,
) -> LearningProgress {
    let packs = packs_of(curriculum);
    let pack_progress = derive_curriculum_pack_progress(snapshot);
    let multiplication = multiplication_facts(&packs, pack_progress.bonus1112.unlocked);
    let division = if packs.contains(&CurriculumPack::InverseDivision)
        && pack_progress.inverse_division.unlocked
    {
        division_curriculum_for(snapshot)
    } else {
        Vec::new()
    };
    let multiplication_keys: Vec<String> = multiplication
        .iter()
        .map(|(left, right)| canonical_fact_key(*left, *right))
        .collect();
    let division_keys: Vec<String> = division.iter().map(|fact| fact.fact_key.clone()).collect();
    let mut tables: Vec<i64> = Vec::new();
    for (left, right) in &multiplication {
        for value in [*left, *right] {
            if !tables.contains(&value) {
                tables.push(value);
            }
        }
    }
    tables.sort_unstable();
    let all_keys: Vec<String> = multiplication_keys
        .iter()
        .chain(division_keys.iter())
        .cloned()
        .collect();

    LearningProgress {
        conjugation: conjugation_progress(snapshot, curriculum),
        division_facts: counts_for_keys(&snapshot.facts, &division_keys),
        facts: counts_for_keys(&snapshot.facts, &all_keys),
        paths: curriculum
            .and_then(|curriculum| curriculum.paths.as_ref())
            .map_or_else(Vec::new, |paths| {
                derive_path_progress(&snapshot.facts, paths, pack_progress.bonus1112.unlocked)
            }),
        packs: pack_progress,
        tables: tables
            .into_iter()
            .map(|table| TableLearningProgress {
                facts: counts_for_keys(
                    &snapshot.facts,
                    &multiplication
                        .iter()
                        .filter(|(left, right)| *left == table || *right == table)
                        .map(|(left, right)| canonical_fact_key(*left, *right))
                        .collect::<Vec<_>>(),
                ),
                table,
            })
            .collect(),
    }
}

/* ------------------------------------------------------------------------------------------ */
/* Sessions                                                                                   */
/* ------------------------------------------------------------------------------------------ */

#[derive(Clone, Debug)]
struct Candidate {
    fact: CurriculumFact,
    due: bool,
    mastery: Option<FactMastery>,
    reviewed_today: bool,
    score: f64,
    weak: bool,
}

impl Candidate {
    fn key(&self) -> &str {
        &self.fact.fact_key
    }

    fn family(&self) -> InteractionFamily {
        interaction_family(self.key())
    }

    fn weight(&self) -> f64 {
        // A form written with letter tiles takes longer than a chosen one.
        if self.fact.skill == Some(SkillId::Conjugation)
            && self
                .mastery
                .as_ref()
                .is_some_and(|mastery| mastery.state.is_stable())
        {
            return WRITTEN_FORM_WEIGHT;
        }
        skill_weight(self.key())
    }

    fn is_due_or_weak(&self) -> bool {
        self.mastery.is_some() && (self.due || self.weak)
    }

    fn seen(&self) -> bool {
        self.mastery.is_some()
    }
}

fn dedupe_first(candidates: Vec<&Candidate>) -> Vec<&Candidate> {
    let mut keys: Vec<&str> = Vec::new();
    candidates
        .into_iter()
        .filter(|candidate| {
            if keys.contains(&candidate.key()) {
                false
            } else {
                keys.push(candidate.key());
                true
            }
        })
        .collect()
}

fn select_balanced_facts<'a>(candidates: &[&'a Candidate], count: i64) -> Vec<&'a Candidate> {
    let priority_review: Vec<&Candidate> = candidates
        .iter()
        .copied()
        .filter(|candidate| candidate.seen() && (candidate.due || candidate.weak))
        .collect();
    let older_review: Vec<&Candidate> = candidates
        .iter()
        .copied()
        .filter(|candidate| {
            candidate.seen() && !candidate.due && !candidate.weak && !candidate.reviewed_today
        })
        .collect();
    let recent_review: Vec<&Candidate> = candidates
        .iter()
        .copied()
        .filter(|candidate| {
            candidate.seen() && !candidate.due && !candidate.weak && candidate.reviewed_today
        })
        .collect();
    let unseen: Vec<&Candidate> = candidates
        .iter()
        .copied()
        .filter(|candidate| !candidate.seen())
        .collect();
    // Urgent sessions spend half their slots on due or weak facts and reserve 30% for
    // unseen material. Otherwise, half-new sessions prevent a recently learned pool
    // from monopolizing practice; remaining mixed slots prefer older reviews.
    let priority_target = if priority_review.is_empty() {
        0
    } else {
        (count as f64 / 2.0).floor().max(1.0) as usize
    };
    let unseen_target = if priority_review.is_empty() {
        (count as f64 / 2.0).ceil() as usize
    } else if count == 1 {
        0
    } else {
        (count as f64 * 0.3).ceil() as usize
    };
    let mut selected: Vec<&Candidate> = priority_review
        .iter()
        .take(priority_target)
        .chain(unseen.iter().take(unseen_target))
        .copied()
        .collect();
    let selected_keys: Vec<String> = selected
        .iter()
        .map(|candidate| candidate.key().to_owned())
        .collect();
    let remaining_priority: Vec<&Candidate> = priority_review
        .iter()
        .skip(priority_target)
        .copied()
        .collect();
    let older_priority = remaining_priority
        .iter()
        .copied()
        .filter(|candidate| !candidate.reviewed_today);
    let recent_priority = remaining_priority
        .iter()
        .copied()
        .filter(|candidate| candidate.reviewed_today);
    let remaining_unseen = unseen.iter().skip(unseen_target).copied();
    let mixed: Vec<&Candidate> = if priority_review.is_empty() {
        older_review
            .iter()
            .copied()
            .chain(recent_review.iter().copied())
            .chain(remaining_unseen)
            .chain(candidates.iter().copied())
            .collect()
    } else {
        older_review
            .iter()
            .copied()
            .chain(older_priority)
            .chain(remaining_unseen)
            .chain(recent_review.iter().copied())
            .chain(recent_priority)
            .chain(candidates.iter().copied())
            .collect()
    };
    let fill_count = (count - selected.len() as i64).max(0) as usize;
    let fill = dedupe_first(
        mixed
            .into_iter()
            .filter(|candidate| !selected_keys.iter().any(|key| key == candidate.key()))
            .collect(),
    );
    selected.extend(fill.into_iter().take(fill_count));
    selected
}

/// A long written calculation weighs three questions, so at most `limit` fit in a session.
fn limit_columns<'a>(candidates: &[&'a Candidate], limit: usize) -> Vec<&'a Candidate> {
    let mut columns = 0;
    candidates
        .iter()
        .copied()
        .filter(|candidate| {
            if candidate.family() != InteractionFamily::Column {
                return true;
            }
            columns += 1;
            columns <= limit
        })
        .collect()
}

/// A session keeps at most two interaction families so the screen stays calm. The families that
/// matter most today, due work first, are the ones kept.
fn limit_families<'a>(
    candidates: &[&'a Candidate],
    required: Option<InteractionFamily>,
) -> Vec<&'a Candidate> {
    let mut families: Vec<InteractionFamily> = required.into_iter().collect();
    let ordered = candidates
        .iter()
        .filter(|candidate| candidate.is_due_or_weak())
        .chain(candidates.iter());
    for candidate in ordered {
        let family = candidate.family();
        if !families.contains(&family) && families.len() < 2 {
            families.push(family);
        }
    }
    candidates
        .iter()
        .copied()
        .filter(|candidate| families.contains(&candidate.family()))
        .collect()
}

fn group_by_family<'a>(selection: &[&'a Candidate]) -> Vec<&'a Candidate> {
    let mut order: Vec<InteractionFamily> = Vec::new();
    for candidate in selection {
        if !order.contains(&candidate.family()) {
            order.push(candidate.family());
        }
    }
    order
        .into_iter()
        .flat_map(|family| {
            selection
                .iter()
                .copied()
                .filter(move |candidate| candidate.family() == family)
        })
        .collect()
}

/// Repeats a focused skill's open levels, most urgent first, until the points are spent.
fn fill_focus<'a>(
    candidates: &[&'a Candidate],
    points: f64,
    max_questions: usize,
) -> Vec<&'a Candidate> {
    let mut selection = Vec::new();
    if candidates.is_empty() {
        return selection;
    }
    let mut spent = 0.0;
    let mut index = 0;
    while spent < points && selection.len() < max_questions {
        let candidate = candidates[index % candidates.len()];
        selection.push(candidate);
        spent += candidate.weight();
        index += 1;
    }
    selection
}

/// At most this many items a learner has never seen enter one daily watering (version 2).
const MAX_NEW_ITEMS: usize = 2;
/// A meadow watering asks at least this many questions, coming back to its verbs at other persons.
const MEADOW_MIN_QUESTIONS: usize = 5;

/// Repeats `selection` in order until it holds `minimum` questions; an empty one stays empty.
fn repeat_to<'a>(selection: Vec<&'a Candidate>, minimum: usize) -> Vec<&'a Candidate> {
    if selection.is_empty() || selection.len() >= minimum {
        return selection;
    }
    selection.iter().copied().cycle().take(minimum).collect()
}

/// The distinct items in `selection` the learner has never seen.
fn new_items(selection: &[&Candidate]) -> usize {
    dedupe_first(
        selection
            .iter()
            .copied()
            .filter(|candidate| !candidate.seen())
            .collect(),
    )
    .len()
}

/// Keeps the seen items and the first `limit` distinct new ones, with their repetitions.
fn cap_new_items(selection: Vec<&Candidate>, limit: usize) -> Vec<&Candidate> {
    let mut kept: Vec<&str> = Vec::new();
    selection
        .into_iter()
        .filter(|candidate| {
            if candidate.seen() || kept.contains(&candidate.key()) {
                return true;
            }
            if kept.len() < limit {
                kept.push(candidate.key());
                return true;
            }
            false
        })
        .collect()
}

fn select_daily_watering_facts<'a>(
    pool: &[&'a Candidate],
    initial_selection: Vec<&'a Candidate>,
    budget_override: Option<f64>,
    cap_new: bool,
) -> Vec<&'a Candidate> {
    // Version 2: a focus counts in the two new items; a learner with nothing to review yet still
    // gets the five-question introduction.
    let introduction = !pool.iter().any(|candidate| candidate.seen());
    let cap_new = cap_new && !introduction;
    let initial_selection = if cap_new {
        cap_new_items(initial_selection, MAX_NEW_ITEMS)
    } else {
        initial_selection
    };
    let priority: Vec<&Candidate> = pool
        .iter()
        .copied()
        .filter(|candidate| candidate.is_due_or_weak())
        .collect();
    let budget = budget_override.unwrap_or_else(|| (priority.len() as f64).clamp(5.0, 8.0));
    let mut selected = initial_selection;
    let mut selected_keys: Vec<String> = selected
        .iter()
        .map(|candidate| candidate.key().to_owned())
        .collect();
    let mut points: f64 = selected.iter().map(|candidate| candidate.weight()).sum();
    let mut add_until_full = |candidates: Vec<&'a Candidate>, selected: &mut Vec<&'a Candidate>| {
        for candidate in candidates {
            if points >= budget {
                return;
            }
            if selected_keys.iter().any(|key| key == candidate.key()) {
                continue;
            }
            // Weighted questions may overshoot by half a point rather than leave a gap.
            if points + candidate.weight() > budget + 0.5 {
                continue;
            }
            selected.push(candidate);
            selected_keys.push(candidate.key().to_owned());
            points += candidate.weight();
        }
    };
    add_until_full(priority, &mut selected);
    add_until_full(
        pool.iter()
            .copied()
            .filter(|candidate| candidate.seen() && !candidate.reviewed_today)
            .collect(),
        &mut selected,
    );
    add_until_full(
        pool.iter()
            .copied()
            .filter(|candidate| candidate.seen())
            .collect(),
        &mut selected,
    );
    let unseen: Vec<&Candidate> = pool
        .iter()
        .copied()
        .filter(|candidate| !candidate.seen())
        .collect();
    let allowance = if cap_new {
        MAX_NEW_ITEMS.saturating_sub(new_items(&selected))
    } else {
        2
    };
    add_until_full(
        unseen.iter().take(allowance).copied().collect(),
        &mut selected,
    );
    if cap_new {
        // Version 2: a shorter watering rather than a third new item.
        return selected;
    }
    // A brand-new learner has no review pool yet. Fill the five-question introduction, then
    // future waterings cap new material at two facts while reviews are available.
    add_until_full(unseen, &mut selected);
    selected
}

/// Everything a session needs besides the policy.
#[derive(Clone, Debug)]
pub struct SessionInput<'a> {
    pub now: Millis,
    pub seed: u32,
    pub snapshot: &'a LearningSnapshot,
    pub time_zone: &'a str,
}

pub fn create_session(
    input: &SessionInput<'_>,
    policy: &PracticePolicy,
    day_keys: &dyn DayKeys,
) -> PracticeSession {
    let SessionInput {
        now,
        seed,
        snapshot,
        time_zone,
    } = *input;
    let mut random = Rng::new(seed);
    let meadow = policy.is_meadow();
    // The meadow's watering is composed like the daily one, on the verbs alone.
    let daily = policy.is_daily() || meadow;
    let maths_only = policy.is_daily() && policy.separates_gardens();
    let today_key = day_keys.day_key(now, time_zone);
    let packs = packs_of(policy.curriculum.as_ref());
    let pack_progress = derive_curriculum_pack_progress(snapshot);
    let multiplication: Vec<CurriculumFact> =
        multiplication_facts(&packs, pack_progress.bonus1112.unlocked)
            .into_iter()
            .map(|(left, right)| CurriculumFact {
                fact_key: canonical_fact_key(left, right),
                left,
                operation: QuestionOperation::Multiply,
                right,
                skill: None,
                skill_index: None,
                tables: if left == right {
                    vec![left]
                } else {
                    vec![left, right]
                },
            })
            .collect();
    let division = if packs.contains(&CurriculumPack::InverseDivision)
        && pack_progress.inverse_division.unlocked
    {
        division_curriculum_for(snapshot)
    } else {
        Vec::new()
    };
    let path_settings: Option<&LearningPathSettings> = policy
        .curriculum
        .as_ref()
        .and_then(|curriculum| curriculum.paths.as_ref());
    let open_skills = path_settings.map_or_else(Vec::new, |settings| {
        derive_open_skills(&snapshot.facts, settings, pack_progress.bonus1112.unlocked)
    });
    let path_curriculum = open_skills.iter().flat_map(|skill| {
        skill
            .keys
            .iter()
            .enumerate()
            .map(|(skill_index, key)| CurriculumFact {
                fact_key: key.clone(),
                left: 0,
                operation: QuestionOperation::Multiply,
                right: 0,
                skill: Some(skill.id),
                skill_index: Some(skill_index),
                tables: Vec::new(),
            })
    });
    let conjugation_settings = path_settings.and_then(|settings| settings.conjugation.as_ref());
    let conjugation_curriculum = conjugation_settings
        .map(conjugation_keys)
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(skill_index, key)| CurriculumFact {
            fact_key: key,
            left: 0,
            operation: QuestionOperation::Multiply,
            right: 0,
            skill: Some(SkillId::Conjugation),
            skill_index: Some(skill_index),
            tables: Vec::new(),
        });
    let curriculum: Vec<CurriculumFact> = multiplication
        .into_iter()
        .chain(division)
        .chain(path_curriculum)
        .chain(conjugation_curriculum)
        .collect();

    let mut candidates: Vec<Candidate> = curriculum
        .into_iter()
        .enumerate()
        .map(|(curriculum_index, fact)| {
            let mastery = snapshot.facts.get(&fact.fact_key).cloned();
            let due = mastery
                .as_ref()
                .and_then(|mastery| mastery.due_at)
                .is_some_and(|due_at| due_at <= now);
            let reviewed_today = match &mastery {
                Some(mastery) => match (&mastery.last_reviewed_day_key, mastery.last_reviewed_at) {
                    (Some(day), _) if !day.is_empty() => *day == today_key,
                    (_, Some(at)) => day_keys.day_key(at, time_zone) == today_key,
                    _ => false,
                },
                None => false,
            };
            let weak = mastery.as_ref().is_some_and(|mastery| {
                mastery.correct_streak == 0
                    || (mastery.lapse_count > 0 && mastery.correct_streak == 1)
                    || mastery.difficulty >= WEAK_FACT_DIFFICULTY
                    || is_slow(&fact.fact_key, mastery.latency_ms)
            });
            let state_score = match &mastery {
                None => match fact.skill_index {
                    None => (120.0 - curriculum_index as f64).max(0.0),
                    Some(skill_index) => (125.0 - skill_index as f64 * 4.0).max(0.0),
                },
                Some(mastery) => match mastery.state {
                    MasteryState::Learning => 260.0,
                    MasteryState::Familiar => 210.0,
                    _ => 40.0,
                },
            };
            let due_score = if due { 220.0 } else { 0.0 };
            let latency_score = if is_slow(
                &fact.fact_key,
                mastery.as_ref().and_then(|mastery| mastery.latency_ms),
            ) {
                35.0
            } else {
                0.0
            };
            let difficulty_score =
                mastery.as_ref().map_or(0.0, |mastery| mastery.difficulty) * 40.0;
            let score = state_score + due_score + latency_score + difficulty_score + random.next();
            Candidate {
                fact,
                due,
                mastery,
                reviewed_today,
                score,
                weak,
            }
        })
        .collect();
    candidates.sort_by(|first, second| {
        second
            .score
            .partial_cmp(&first.score)
            .unwrap_or(Ordering::Equal)
    });
    let is_verb = |candidate: &Candidate| candidate.fact.skill == Some(SkillId::Conjugation);
    let all: Vec<&Candidate> = candidates
        .iter()
        .filter(|candidate| {
            if meadow {
                is_verb(candidate)
            } else {
                !(maths_only && is_verb(candidate))
            }
        })
        .collect();

    // A verb « en ce moment en classe » puts its keys forward, and wins over a maths skill.
    let conjugation_focus = if maths_only {
        None
    } else if daily {
        conjugation_settings.and_then(|settings| settings.focus.as_ref())
    } else {
        policy.focus_verb.as_ref()
    };
    let focus_keys: Option<Vec<String>> = conjugation_settings
        .zip(conjugation_focus)
        .map(|(settings, focus)| conjugation_focus_keys(settings, focus))
        .filter(|keys| !keys.is_empty());
    let focus_skill = if focus_keys.is_some() {
        Some(SkillId::Conjugation)
    } else if meadow {
        None
    } else if daily {
        path_settings.and_then(|settings| settings.focus_skill)
    } else {
        policy.focus_skill
    };
    let in_focus = |candidate: &Candidate| match &focus_keys {
        Some(keys) => keys.iter().any(|key| key == candidate.key()),
        None => candidate.fact.skill == focus_skill,
    };
    let focus_candidates: Vec<&Candidate> = match focus_skill {
        None => Vec::new(),
        Some(_) => all
            .iter()
            .copied()
            .filter(|candidate| in_focus(candidate))
            .collect(),
    };
    let focus_family = match focus_skill {
        Some(skill) if !focus_candidates.is_empty() => Some(skill_definition(skill).family),
        _ => None,
    };
    let question_count = if daily {
        0
    } else {
        policy.question_count.unwrap_or(0)
    };
    let focus_table = if daily { None } else { policy.focus_table };
    let focus_count = (question_count - 2).max(0);
    let unfocused: Vec<&Candidate> = all
        .iter()
        .copied()
        .filter(|candidate| !in_focus(candidate))
        .collect();
    let column_focus = focus_family == Some(InteractionFamily::Column);

    let selected: Vec<&Candidate> = if daily {
        let picked = match focus_family {
            None => select_daily_watering_facts(
                &limit_families(&limit_columns(&all, 2), None),
                Vec::new(),
                None,
                policy.caps_new_items(),
            ),
            Some(family) => {
                // A skill the parent put forward takes about half of the watering; reviews fill
                // the rest.
                let priority = all
                    .iter()
                    .filter(|candidate| candidate.is_due_or_weak())
                    .count();
                let budget = (priority as f64).clamp(5.0, 8.0);
                let focused = fill_focus(
                    &focus_candidates,
                    budget / 2.0,
                    if column_focus { 1 } else { 8 },
                );
                select_daily_watering_facts(
                    &limit_families(
                        &limit_columns(&unfocused, if column_focus { 1 } else { 2 }),
                        Some(family),
                    ),
                    focused,
                    Some(budget),
                    policy.caps_new_items(),
                )
            }
        };
        let grouped = group_by_family(&picked);
        if meadow {
            repeat_to(grouped, MEADOW_MIN_QUESTIONS)
        } else {
            grouped
        }
    } else if focus_family.is_some() {
        let mut picked = fill_focus(
            &focus_candidates,
            focus_count as f64,
            if column_focus {
                3
            } else {
                focus_count.max(0) as usize
            },
        );
        picked.extend(select_balanced_facts(
            &limit_columns(&unfocused, 0),
            question_count - focus_count,
        ));
        picked
    } else if let Some(table) = focus_table {
        let (inside, outside): (Vec<&Candidate>, Vec<&Candidate>) = all
            .iter()
            .copied()
            .partition(|candidate| candidate.fact.tables.contains(&table));
        let mut picked = select_balanced_facts(&inside, focus_count);
        picked.extend(select_balanced_facts(
            &outside,
            question_count - focus_count,
        ));
        picked
    } else {
        group_by_family(&select_balanced_facts(
            &limit_families(&limit_columns(&all, 2), None),
            question_count,
        ))
    };

    let questions: Vec<PracticeQuestion> = selected
        .iter()
        .enumerate()
        .map(|(index, candidate)| {
            let id = format!("q-{seed}-{}", index + 1);
            let recall = candidate
                .mastery
                .as_ref()
                .is_some_and(|mastery| mastery.state.is_stable());
            if candidate.fact.skill.is_some() {
                let exercise = generate_exercise(candidate.key(), &mut random, recall)
                    .expect("open skill levels always have a generator");
                return PracticeQuestion {
                    answer_mode: if is_production_exercise(&exercise) {
                        AnswerMode::Keypad
                    } else {
                        AnswerMode::Choice
                    },
                    choices: Vec::new(),
                    exercise: Some(exercise),
                    fact_key: candidate.key().to_owned(),
                    id,
                    left: 0,
                    operation: QuestionOperation::Multiply,
                    right: 0,
                };
            }
            let fact = &candidate.fact;
            let reverse = fact.operation == QuestionOperation::Multiply
                && fact.left != fact.right
                && random.next() >= 0.5;
            let (left, right) = if reverse {
                (fact.right, fact.left)
            } else {
                (fact.left, fact.right)
            };
            let answer_mode = if recall {
                AnswerMode::Keypad
            } else {
                AnswerMode::Choice
            };
            PracticeQuestion {
                answer_mode,
                choices: if answer_mode == AnswerMode::Choice {
                    choices_for(left, fact.operation, right, &mut random)
                } else {
                    Vec::new()
                },
                exercise: None,
                fact_key: candidate.key().to_owned(),
                id,
                left,
                operation: fact.operation,
                right,
            }
        })
        .collect();

    PracticeSession {
        algorithm_version: policy.algorithm_version.clone(),
        created_at: now,
        current_question_started_at: now,
        current_index: 0,
        id: format!("session-{now}-{seed}"),
        kind: if meadow {
            SessionKind::MeadowWatering
        } else if daily {
            SessionKind::DailyWatering
        } else {
            SessionKind::ExtraPractice
        },
        questions,
        seed,
        time_zone: time_zone.to_owned(),
    }
}

/// The learner's answer: a whole number for facts, a typed answer for path exercises.
#[derive(Clone, Debug)]
pub enum LearnerAnswer {
    Selected(i64),
    Response(PracticeAnswer),
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct AnswerOutcome {
    pub correct: bool,
    pub event: AttemptEvent,
    pub session: PracticeSession,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AnswerError {
    SessionComplete,
    ResponseRequired,
}

pub fn answer(
    session: &PracticeSession,
    learner_answer: &LearnerAnswer,
    answered_at: Millis,
    event_id: &str,
    day_keys: &dyn DayKeys,
) -> Result<AnswerOutcome, AnswerError> {
    let index = usize::try_from(session.current_index).map_err(|_| AnswerError::SessionComplete)?;
    let question = session
        .questions
        .get(index)
        .ok_or(AnswerError::SessionComplete)?;
    let response = match learner_answer {
        LearnerAnswer::Response(response) => Some(response),
        LearnerAnswer::Selected(_) => None,
    };
    let selected = match learner_answer {
        LearnerAnswer::Selected(value) => Some(*value),
        LearnerAnswer::Response(_) => None,
    };
    if question.exercise.is_some() && response.is_none() {
        return Err(AnswerError::ResponseRequired);
    }
    let correct = match (&question.exercise, response) {
        (Some(exercise), Some(response)) => is_exercise_answer_correct(exercise, response),
        _ => selected == Some(correct_answer(question)),
    };
    let event = AttemptEvent {
        answer_mode: question.answer_mode,
        answered_at,
        choices: question.choices.clone(),
        correct,
        event_id: event_id.to_owned(),
        exercise: question.exercise.clone(),
        fact_key: question.fact_key.clone(),
        latency_ms: (answered_at - session.current_question_started_at).max(0) as f64,
        learning_day_key: Some(day_keys.day_key(answered_at, &session.time_zone)),
        left: question.left,
        operation: Some(question.operation),
        response: question.exercise.as_ref().and(response.cloned()),
        right: question.right,
        question_count: session.questions.len() as i64,
        selected: match (&question.exercise, response) {
            (None, _) => selected.unwrap_or(0),
            (Some(_), Some(PracticeAnswer::Integer { value })) => *value,
            _ => 0,
        },
        sequence: session.current_index,
        session_id: session.id.clone(),
        session_kind: Some(session.kind),
        algorithm_version: session.algorithm_version.clone(),
    };
    let mut questions = session.questions.clone();
    if !correct && index + 1 < questions.len() {
        let retry_index = (questions.len() - 1).min(index + 3);
        let mut retry = question.clone();
        retry.id = format!("{}-retry-{event_id}", question.id);
        questions.insert(retry_index, retry);
        questions.pop();
    }
    Ok(AnswerOutcome {
        correct,
        event,
        session: PracticeSession {
            current_index: session.current_index + 1,
            current_question_started_at: answered_at,
            questions,
            ..session.clone()
        },
    })
}

/// Checks a learning-path attempt the way the server must: the exercise is well formed, belongs to
/// the skill named by its key, and the recorded correctness matches a recomputed answer.
pub fn validate_exercise_attempt(attempt: &AttemptEvent) -> bool {
    let (Some(exercise), Some(response)) = (&attempt.exercise, &attempt.response) else {
        return false;
    };
    if skill_for_key(&attempt.fact_key) != Some(exercise.skill()) {
        return false;
    }
    if !is_exercise_well_formed(exercise) {
        return false;
    }
    if let Exercise::Conjugation(conjugation) = exercise
        && attempt.fact_key != crate::conjugation::key(&conjugation.verb, conjugation.tense)
    {
        return false;
    }
    if let Exercise::Arithmetic(arithmetic) = exercise {
        if arithmetic.skill == SkillId::AdditionFacts {
            let expected = format!(
                "add:{}:{}",
                arithmetic.left.min(arithmetic.right),
                arithmetic.left.max(arithmetic.right)
            );
            if attempt.fact_key != expected {
                return false;
            }
        }
        if arithmetic.skill == SkillId::SubtractionFacts
            && attempt.fact_key != format!("sub:{}:{}", arithmetic.left, arithmetic.right)
        {
            return false;
        }
    }
    let production = is_production_exercise(exercise);
    if (attempt.answer_mode == AnswerMode::Keypad) != production {
        return false;
    }
    if !attempt.choices.is_empty() {
        return false;
    }
    if !production
        && let Some(choices) = exercise.choices()
        && !choices.is_empty()
        && !choices.contains(response)
    {
        return false;
    }
    attempt.correct == is_exercise_answer_correct(exercise, response)
        && attempt.sequence < attempt.question_count
}

/* ------------------------------------------------------------------------------------------ */
/* Insight and rescue                                                                         */
/* ------------------------------------------------------------------------------------------ */

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum InsightKind {
    FactsBecameFamiliar,
    FactsBecameFluent,
    FactsPractised,
    KeypadRecalls,
    MistakesRecovered,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInsight {
    pub count: i64,
    pub fact_keys: Vec<String>,
    pub kind: InsightKind,
}

fn insight(kind: InsightKind, fact_keys: Vec<String>) -> Option<SessionInsight> {
    (!fact_keys.is_empty()).then_some(SessionInsight {
        count: fact_keys.len() as i64,
        fact_keys,
        kind,
    })
}

fn unique_keys<'a>(keys: impl Iterator<Item = &'a str>) -> Vec<String> {
    let set: IndexSet<&str> = keys.collect();
    set.into_iter().map(str::to_owned).collect()
}

pub fn derive_session_insight(
    attempts: &[AttemptEvent],
    snapshot: &LearningSnapshot,
    time_zone: &str,
    day_keys: &dyn DayKeys,
) -> Option<SessionInsight> {
    let after = reduce(snapshot, attempts, time_zone, day_keys);
    let keys = unique_keys(attempts.iter().map(|attempt| attempt.fact_key.as_str()));
    let before_state = |key: &str| snapshot.facts.get(key).map(|mastery| mastery.state);
    let after_state = |key: &str| after.facts.get(key).map(|mastery| mastery.state);
    let became_fluent: Vec<String> = keys
        .iter()
        .filter(|key| {
            after_state(key) == Some(MasteryState::Fluent)
                && before_state(key) != Some(MasteryState::Fluent)
        })
        .cloned()
        .collect();
    if let Some(found) = insight(InsightKind::FactsBecameFluent, became_fluent) {
        return Some(found);
    }
    let became_familiar: Vec<String> = keys
        .iter()
        .filter(|key| {
            let before = before_state(key).unwrap_or(MasteryState::Unseen);
            after_state(key) == Some(MasteryState::Familiar) && !before.is_stable()
        })
        .cloned()
        .collect();
    if let Some(found) = insight(InsightKind::FactsBecameFamiliar, became_familiar) {
        return Some(found);
    }
    let mut missed: IndexSet<&str> = IndexSet::new();
    let mut recovered: IndexSet<&str> = IndexSet::new();
    for attempt in attempts {
        if !attempt.correct {
            missed.insert(&attempt.fact_key);
        } else if missed.contains(attempt.fact_key.as_str()) {
            recovered.insert(&attempt.fact_key);
        }
    }
    if let Some(found) = insight(
        InsightKind::MistakesRecovered,
        recovered.into_iter().map(str::to_owned).collect(),
    ) {
        return Some(found);
    }
    let keypad = unique_keys(
        attempts
            .iter()
            .filter(|attempt| attempt.answer_mode == AnswerMode::Keypad && attempt.correct)
            .map(|attempt| attempt.fact_key.as_str()),
    );
    if let Some(found) = insight(InsightKind::KeypadRecalls, keypad) {
        return Some(found);
    }
    insight(
        InsightKind::FactsPractised,
        unique_keys(
            attempts
                .iter()
                .filter(|attempt| attempt.correct)
                .map(|attempt| attempt.fact_key.as_str()),
        ),
    )
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeFact {
    pub fact_key: String,
    pub factor: i64,
    pub product: i64,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum BridgeOperator {
    Add,
    Subtract,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum RescueStrategy {
    Array {
        columns: i64,
        rows: i64,
        total: i64,
    },
    CommutativeFlip {
        left: i64,
        right: i64,
        total: i64,
    },
    #[serde(rename_all = "camelCase")]
    KnownFactBridge {
        adjustment: BridgeFact,
        anchor: BridgeFact,
        common_factor: i64,
        operator: BridgeOperator,
        target_factor: i64,
        total: i64,
    },
}

pub fn derive_rescue_strategies(
    question: &PracticeQuestion,
    snapshot: &LearningSnapshot,
) -> Vec<RescueStrategy> {
    if question.exercise.is_some() || question.operation != QuestionOperation::Multiply {
        return Vec::new();
    }
    let total = correct_answer(question);
    let mut strategies = vec![RescueStrategy::Array {
        columns: question.right,
        rows: question.left,
        total,
    }];
    if question.left != question.right {
        strategies.push(RescueStrategy::CommutativeFlip {
            left: question.right,
            right: question.left,
            total,
        });
    }
    const PREFERRED_ANCHORS: [i64; 12] = [10, 5, 2, 1, 12, 11, 9, 8, 7, 6, 4, 3];
    for (common_factor, target_factor) in [
        (question.right, question.left),
        (question.left, question.right),
    ] {
        for anchor_factor in PREFERRED_ANCHORS {
            if anchor_factor == target_factor {
                continue;
            }
            let adjustment_factor = (target_factor - anchor_factor).abs();
            if adjustment_factor == 0 {
                continue;
            }
            let anchor_key = canonical_fact_key(anchor_factor, common_factor);
            let adjustment_key = canonical_fact_key(adjustment_factor, common_factor);
            if state_of(&snapshot.facts, &anchor_key) != MasteryState::Fluent
                || state_of(&snapshot.facts, &adjustment_key) != MasteryState::Fluent
            {
                continue;
            }
            strategies.push(RescueStrategy::KnownFactBridge {
                adjustment: BridgeFact {
                    fact_key: adjustment_key,
                    factor: adjustment_factor,
                    product: adjustment_factor * common_factor,
                },
                anchor: BridgeFact {
                    fact_key: anchor_key,
                    factor: anchor_factor,
                    product: anchor_factor * common_factor,
                },
                common_factor,
                operator: if anchor_factor < target_factor {
                    BridgeOperator::Add
                } else {
                    BridgeOperator::Subtract
                },
                target_factor,
                total,
            });
            return strategies;
        }
    }
    strategies
}

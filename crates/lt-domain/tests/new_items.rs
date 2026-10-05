//! Version 2 of session composition: a daily watering adds at most two items the learner has
//! never seen (CE2 spec §6.1), focus and paths included. Version 1 stays as it was.

use lt_domain::day_key::UtcDayKeys;
use lt_domain::engine::{
    LearnerAnswer, SessionInput, answer, canonical_fact_key, correct_answer, create_session, reduce,
};
use lt_domain::model::{
    ALGORITHM_VERSION_2, AnswerMode, AttemptEvent, CurriculumPolicy, FactMastery,
    LearningPathSettings, LearningSnapshot, MasteryState, PathMode, PracticePolicy,
    PracticeSession, QuestionOperation, SessionKind, SkillId,
};
use proptest::prelude::*;

const NOW: i64 = 1_790_000_000_000;
const DAY: i64 = 86_400_000;

fn daily(version: Option<&str>, paths: LearningPathSettings) -> PracticePolicy {
    PracticePolicy {
        algorithm_version: version.map(str::to_owned),
        curriculum: Some(CurriculumPolicy {
            packs: None,
            paths: Some(paths),
        }),
        kind: Some(SessionKind::DailyWatering),
        ..PracticePolicy::default()
    }
}

fn automatic() -> LearningPathSettings {
    LearningPathSettings {
        mode: PathMode::Automatic,
        ..LearningPathSettings::default()
    }
}

fn mastery(state: MasteryState) -> FactMastery {
    FactMastery {
        correct_count: 6,
        correct_streak: 3,
        difficulty: 0.2,
        due_at: Some(NOW + 30 * DAY),
        last_reviewed_at: Some(NOW - 2 * DAY),
        state,
        stability_days: 20.0,
        ..FactMastery::empty()
    }
}

/// Tables 1 to 10 well rooted: the new paths are open and every path level is new.
fn tables_acquired() -> LearningSnapshot {
    let mut snapshot = LearningSnapshot::default();
    for left in 1..=10 {
        for right in left..=10 {
            snapshot.facts.insert(
                canonical_fact_key(left, right),
                mastery(MasteryState::Fluent),
            );
        }
    }
    snapshot
}

fn session(snapshot: &LearningSnapshot, policy: &PracticePolicy, seed: u32) -> PracticeSession {
    create_session(
        &SessionInput {
            now: NOW,
            seed,
            snapshot,
            time_zone: "UTC",
        },
        policy,
        &UtcDayKeys,
    )
}

/// The distinct items of the session the learner has never seen.
fn new_items(session: &PracticeSession, snapshot: &LearningSnapshot) -> Vec<String> {
    let mut keys: Vec<String> = session
        .questions
        .iter()
        .map(|question| question.fact_key.clone())
        .filter(|key| !snapshot.facts.contains_key(key))
        .collect();
    keys.sort();
    keys.dedup();
    keys
}

#[test]
fn opening_paths_bring_at_most_two_new_items_per_watering() {
    let snapshot = tables_acquired();
    for seed in 0..200 {
        let capped = session(
            &snapshot,
            &daily(Some(ALGORITHM_VERSION_2), automatic()),
            seed,
        );
        assert!(new_items(&capped, &snapshot).len() <= 2, "seed {seed}");
        assert_eq!(
            capped.algorithm_version.as_deref(),
            Some(ALGORITHM_VERSION_2)
        );
    }
}

#[test]
fn a_focus_counts_in_the_two_new_items() {
    let snapshot = tables_acquired();
    let focused = LearningPathSettings {
        enabled_skills: vec![SkillId::AdditionFacts],
        focus_skill: Some(SkillId::AdditionFacts),
        mode: PathMode::Manual,
        ..LearningPathSettings::default()
    };
    let mut before_cap = 0;
    for seed in 0..100 {
        let previous = session(&snapshot, &daily(None, focused.clone()), seed);
        before_cap = before_cap.max(new_items(&previous, &snapshot).len());
        let capped = session(
            &snapshot,
            &daily(Some(ALGORITHM_VERSION_2), focused.clone()),
            seed,
        );
        let new = new_items(&capped, &snapshot);
        assert!(!new.is_empty() && new.len() <= 2, "seed {seed}: {new:?}");
    }
    // Version 1 put more than two new levels forward: the reason for version 2.
    assert!(before_cap > 2);
}

#[test]
fn a_short_review_pool_gives_a_shorter_watering_rather_than_more_new_items() {
    let mut snapshot = LearningSnapshot::default();
    snapshot
        .facts
        .insert(canonical_fact_key(2, 3), mastery(MasteryState::Learning));
    let previous = session(&snapshot, &daily(None, automatic()), 7);
    let capped = session(&snapshot, &daily(Some(ALGORITHM_VERSION_2), automatic()), 7);
    assert!(new_items(&previous, &snapshot).len() > 2);
    assert_eq!(new_items(&capped, &snapshot).len(), 2);
    assert_eq!(capped.questions.len(), 3);
}

#[test]
fn a_brand_new_learner_still_gets_the_introduction() {
    let empty = LearningSnapshot::default();
    let previous = session(&empty, &daily(None, automatic()), 3);
    let capped = session(&empty, &daily(Some(ALGORITHM_VERSION_2), automatic()), 3);
    assert_eq!(previous.questions, capped.questions);
    assert_eq!(capped.questions.len(), 5);
}

#[test]
fn answers_carry_the_version_of_their_session() {
    // A first watering asks multiplication facts only.
    let empty = LearningSnapshot::default();
    for (version, expected) in [(Some(ALGORITHM_VERSION_2), Some("2")), (None, None)] {
        let current = session(&empty, &daily(version, automatic()), 11);
        let given = LearnerAnswer::Selected(correct_answer(&current.questions[0]));
        let outcome = answer(&current, &given, NOW + 5_000, "e1", &UtcDayKeys).expect("answered");
        assert_eq!(outcome.event.algorithm_version.as_deref(), expected);
        assert_eq!(outcome.session.algorithm_version.as_deref(), expected);
    }
}

fn attempt(index: usize, fact: (i64, i64), correct: bool, day: i64) -> AttemptEvent {
    AttemptEvent {
        algorithm_version: None,
        answer_mode: AnswerMode::Keypad,
        answered_at: NOW - 40 * DAY + day * DAY + index as i64 * 5_000,
        choices: Vec::new(),
        correct,
        event_id: format!("e{index}"),
        exercise: None,
        fact_key: canonical_fact_key(fact.0, fact.1),
        latency_ms: 2_000.0,
        learning_day_key: None,
        left: fact.0,
        operation: Some(QuestionOperation::Multiply),
        response: None,
        right: fact.1,
        question_count: 10,
        selected: 0,
        sequence: 0,
        session_id: "s".to_owned(),
        session_kind: Some(SessionKind::DailyWatering),
    }
}

proptest! {
    #[test]
    fn no_history_ever_gets_more_than_two_new_items(
        raw in prop::collection::vec((1..=10_i64, 1..=10_i64, any::<bool>(), 0..30_i64), 1..120),
        seed in any::<u32>(),
    ) {
        let mut days: Vec<i64> = raw.iter().map(|entry| entry.3).collect();
        days.sort_unstable();
        let attempts: Vec<AttemptEvent> = raw
            .iter()
            .zip(days)
            .enumerate()
            .map(|(index, (entry, day))| attempt(index, (entry.0, entry.1), entry.2, day))
            .collect();
        let snapshot = reduce(&LearningSnapshot::default(), &attempts, "UTC", &UtcDayKeys);
        let capped = session(&snapshot, &daily(Some(ALGORITHM_VERSION_2), automatic()), seed);
        prop_assert!(new_items(&capped, &snapshot).len() <= 2);
        prop_assert!(!capped.questions.is_empty());
    }
}

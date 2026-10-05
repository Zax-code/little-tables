//! Invariants of the learning engine, checked on generated histories.

use lt_domain::day_key::UtcDayKeys;
use lt_domain::engine::{
    LearnerAnswer, SessionInput, answer, correct_answer, create_session, reduce,
};
use lt_domain::model::{
    AnswerMode, AttemptEvent, CurriculumPolicy, LearningSnapshot, MasteryState, PracticePolicy,
    QuestionOperation, SessionKind,
};
use proptest::prelude::*;

const DAY: i64 = 86_400_000;

fn attempt(index: usize, fact: (i64, i64), correct: bool, keypad: bool, day: i64) -> AttemptEvent {
    AttemptEvent {
        answer_mode: if keypad {
            AnswerMode::Keypad
        } else {
            AnswerMode::Choice
        },
        answered_at: 1_780_000_000_000 + day * DAY + index as i64 * 5_000,
        choices: Vec::new(),
        correct,
        event_id: format!("e{index}"),
        exercise: None,
        fact_key: format!("{}:{}", fact.0.min(fact.1), fact.0.max(fact.1)),
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
        algorithm_version: None,
    }
}

prop_compose! {
    fn history()(raw in prop::collection::vec((1..=4_i64, 1..=4_i64, any::<bool>(), any::<bool>(), 0..20_i64), 1..80)) -> Vec<AttemptEvent> {
        let mut days: Vec<i64> = raw.iter().map(|entry| entry.4).collect();
        days.sort_unstable();
        raw.iter()
            .zip(days)
            .enumerate()
            .map(|(index, (entry, day))| attempt(index, (entry.0, entry.1), entry.2, entry.3, day))
            .collect()
    }
}

fn reduced(attempts: &[AttemptEvent]) -> LearningSnapshot {
    reduce(&LearningSnapshot::default(), attempts, "UTC", &UtcDayKeys)
}

proptest! {
    #[test]
    fn replaying_events_changes_nothing(attempts in history()) {
        let once = reduced(&attempts);
        let twice = reduce(&once, &attempts, "UTC", &UtcDayKeys);
        prop_assert_eq!(once, twice);
    }

    #[test]
    fn reduction_is_deterministic_and_incremental(attempts in history(), split in 0..80_usize) {
        let split = split.min(attempts.len());
        let whole = reduced(&attempts);
        let first = reduced(&attempts[..split]);
        let resumed = reduce(&first, &attempts[split..], "UTC", &UtcDayKeys);
        prop_assert_eq!(&whole, &reduced(&attempts));
        prop_assert_eq!(whole, resumed);
    }

    #[test]
    fn a_single_day_never_makes_a_fact_fluent(raw in prop::collection::vec((1..=3_i64, 1..=3_i64, any::<bool>()), 1..60)) {
        let attempts: Vec<AttemptEvent> = raw
            .iter()
            .enumerate()
            .map(|(index, (left, right, keypad))| attempt(index, (*left, *right), true, *keypad, 0))
            .collect();
        let snapshot = reduced(&attempts);
        for mastery in snapshot.facts.values() {
            prop_assert!(mastery.state != MasteryState::Fluent);
            prop_assert!(mastery.state != MasteryState::Familiar);
        }
    }

    #[test]
    fn mistakes_never_raise_stability_and_successes_never_add_lapses(attempts in history()) {
        let mut snapshot = LearningSnapshot::default();
        for event in &attempts {
            let before = snapshot.facts.get(&event.fact_key).cloned();
            snapshot = reduce(&snapshot, std::slice::from_ref(event), "UTC", &UtcDayKeys);
            let after = &snapshot.facts[&event.fact_key];
            let before_stability = before.as_ref().map_or(0.0, |mastery| mastery.stability_days);
            let before_lapses = before.as_ref().map_or(0, |mastery| mastery.lapse_count);
            if event.correct {
                prop_assert_eq!(after.lapse_count, before_lapses);
            } else {
                prop_assert!(after.stability_days <= before_stability);
            }
        }
    }

    #[test]
    fn sessions_are_reproducible_and_answerable(seed in any::<u32>(), attempts in history()) {
        let snapshot = reduced(&attempts);
        let input = SessionInput { now: 1_790_000_000_000, seed, snapshot: &snapshot, time_zone: "UTC" };
        let policy = PracticePolicy {
            curriculum: Some(CurriculumPolicy::default()),
            kind: Some(SessionKind::DailyWatering),
            ..PracticePolicy::default()
        };
        let session = create_session(&input, &policy, &UtcDayKeys);
        prop_assert_eq!(&session, &create_session(&input, &policy, &UtcDayKeys));
        prop_assert!(!session.questions.is_empty());
        let mut current = session;
        let mut index = 0;
        while (current.current_index as usize) < current.questions.len() {
            let question = &current.questions[current.current_index as usize];
            let outcome = answer(
                &current,
                &LearnerAnswer::Selected(correct_answer(question)),
                input.now + index * 3_000,
                &format!("a{index}"),
                &UtcDayKeys,
            )
            .expect("questions remain");
            prop_assert!(outcome.correct);
            current = outcome.session;
            index += 1;
        }
        prop_assert_eq!(index as usize, current.questions.len());
    }
}

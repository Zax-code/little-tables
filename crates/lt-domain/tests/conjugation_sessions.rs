//! Conjugation in sessions: the parent's verbs enter the watering, a verb « en ce moment en
//! classe » takes about half of it, answers go through the server's checks, and nothing changes
//! for a child without verbs.

use lt_domain::day_key::UtcDayKeys;
use lt_domain::engine::{
    LearnerAnswer, SessionInput, answer, canonical_fact_key, create_session, reduce,
    validate_exercise_attempt,
};
use lt_domain::exercises::expected_answer;
use lt_domain::garden::{
    SessionCompletionDay, derive_garden_reward_ledger, derive_meadow_reward_ledger,
};
use lt_domain::model::{
    ALGORITHM_VERSION_2, ALGORITHM_VERSION_3, AnswerMode, ConjugationFocus, ConjugationSettings,
    CurriculumPolicy, Exercise, FactMastery, LearningPathSettings, LearningSnapshot, MasteryState,
    PathMode, PracticeAnswer, PracticePolicy, PracticeSession, SessionKind, Tense,
};
use lt_domain::paths::validate_learning_paths;
use proptest::prelude::*;

const NOW: i64 = 1_790_000_000_000;
const DAY: i64 = 86_400_000;

fn settings(
    verbs: &[&str],
    tenses: &[Tense],
    focus: Option<ConjugationFocus>,
) -> LearningPathSettings {
    LearningPathSettings {
        mode: PathMode::Manual,
        conjugation: Some(ConjugationSettings {
            focus,
            tenses: tenses.to_vec(),
            verbs: verbs.iter().map(|verb| (*verb).to_owned()).collect(),
        }),
        ..LearningPathSettings::default()
    }
}

fn daily(paths: LearningPathSettings) -> PracticePolicy {
    PracticePolicy {
        algorithm_version: Some(ALGORITHM_VERSION_2.to_owned()),
        curriculum: Some(CurriculumPolicy {
            packs: None,
            paths: Some(paths),
        }),
        kind: Some(SessionKind::DailyWatering),
        ..PracticePolicy::default()
    }
}

fn mastery(state: MasteryState) -> FactMastery {
    FactMastery {
        correct_count: 6,
        correct_streak: 3,
        difficulty: 0.2,
        due_at: Some(NOW - DAY),
        last_reviewed_at: Some(NOW - 2 * DAY),
        state,
        stability_days: 3.0,
        ..FactMastery::empty()
    }
}

/// A child who knows a few tables, so the watering is not the five-question introduction.
fn practised() -> LearningSnapshot {
    let mut snapshot = LearningSnapshot::default();
    for left in 2..=5 {
        snapshot
            .facts
            .insert(canonical_fact_key(left, 2), mastery(MasteryState::Familiar));
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

fn conjugation_questions(session: &PracticeSession) -> usize {
    session
        .questions
        .iter()
        .filter(|question| question.fact_key.starts_with("conj:"))
        .count()
}

#[test]
fn ticked_verbs_enter_the_watering_two_new_at_a_time() {
    let snapshot = practised();
    let policy = daily(settings(
        &["finir", "aller"],
        &[Tense::Present, Tense::Imperfect],
        None,
    ));
    let mut seen = 0;
    for seed in 0..100 {
        let watering = session(&snapshot, &policy, seed);
        let mut new: Vec<&str> = watering
            .questions
            .iter()
            .map(|question| question.fact_key.as_str())
            .filter(|key| !snapshot.facts.contains_key(*key))
            .collect();
        new.sort_unstable();
        new.dedup();
        assert!(new.len() <= 2, "seed {seed}: {new:?}");
        seen += conjugation_questions(&watering);
    }
    assert!(seen > 0);
}

#[test]
fn a_verb_in_class_takes_about_half_the_watering() {
    let mut snapshot = practised();
    for tense in ["present", "imperfect"] {
        snapshot.facts.insert(
            format!("conj:venir:{tense}"),
            mastery(MasteryState::Learning),
        );
    }
    let focus = ConjugationFocus {
        tense: None,
        verb: "venir".to_owned(),
    };
    let policy = daily(settings(
        &["venir", "faire"],
        &[Tense::Present, Tense::Imperfect],
        Some(focus),
    ));
    for seed in 0..50 {
        let watering = session(&snapshot, &policy, seed);
        let venir = watering
            .questions
            .iter()
            .filter(|question| question.fact_key.starts_with("conj:venir:"))
            .count();
        assert!(venir * 3 >= watering.questions.len(), "seed {seed}");
    }
}

#[test]
fn a_verb_session_asks_mostly_that_verb() {
    let snapshot = practised();
    let paths = settings(&["prendre", "voir"], &[Tense::Present], None);
    let policy = PracticePolicy {
        curriculum: Some(CurriculumPolicy {
            packs: None,
            paths: Some(paths),
        }),
        focus_verb: Some(ConjugationFocus {
            tense: None,
            verb: "prendre".to_owned(),
        }),
        question_count: Some(8),
        ..PracticePolicy::default()
    };
    let practice = session(&snapshot, &policy, 3);
    let prendre = practice
        .questions
        .iter()
        .filter(|question| question.fact_key == "conj:prendre:present")
        .count();
    assert_eq!(prendre, 6);
}

#[test]
fn answers_pass_the_server_checks_and_count_as_recall_when_written() {
    let mut snapshot = practised();
    snapshot.facts.insert(
        "conj:finir:present".to_owned(),
        mastery(MasteryState::Familiar),
    );
    let policy = daily(settings(&["finir"], &[Tense::Present], None));
    let mut current = session(&snapshot, &policy, 11);
    let mut events = Vec::new();
    while let Some(question) = current
        .questions
        .get(current.current_index as usize)
        .cloned()
    {
        let learner = match &question.exercise {
            Some(exercise) => LearnerAnswer::Response(expected_answer(exercise)),
            None => LearnerAnswer::Selected(question.left * question.right),
        };
        let outcome = answer(
            &current,
            &learner,
            NOW + events.len() as i64 * 4_000,
            &format!("e{}", events.len()),
            &UtcDayKeys,
        )
        .expect("an answer");
        if let Some(Exercise::Conjugation(exercise)) = &question.exercise {
            assert!(outcome.correct);
            assert!(exercise.choices.is_empty(), "a familiar verb is written");
            assert_eq!(outcome.event.answer_mode, AnswerMode::Keypad);
            assert!(validate_exercise_attempt(&outcome.event));
            let mut forged = outcome.event.clone();
            if let Some(Exercise::Conjugation(forged_exercise)) = &mut forged.exercise {
                forged_exercise.expected = "finisons".to_owned();
            }
            assert!(!validate_exercise_attempt(&forged));
            let mut wrong = outcome.event.clone();
            wrong.response = Some(PracticeAnswer::Text {
                value: "finisent".to_owned(),
            });
            assert!(
                !validate_exercise_attempt(&wrong),
                "correct must match the answer"
            );
            wrong.correct = false;
            assert!(validate_exercise_attempt(&wrong));
        }
        events.push(outcome.event);
        current = outcome.session;
    }
    let after = reduce(&snapshot, &events, "UTC", &UtcDayKeys);
    assert!(after.facts.contains_key("conj:finir:present"));
}

#[test]
fn settings_are_checked() {
    assert!(validate_learning_paths(&settings(
        &["finir"],
        &[Tense::Present],
        None
    )));
    assert!(!validate_learning_paths(&settings(
        &["finir", "finir"],
        &[Tense::Present],
        None
    )));
    assert!(!validate_learning_paths(&settings(
        &["blablare"],
        &[Tense::Present],
        None
    )));
    let wrong_focus = ConjugationFocus {
        tense: Some(Tense::Future),
        verb: "finir".to_owned(),
    };
    assert!(!validate_learning_paths(&settings(
        &["finir"],
        &[Tense::Present],
        Some(wrong_focus)
    )));
    // Sixty-one first-group verbs: one too many.
    let too_many: Vec<String> = (0..61).map(|index| format!("chant{index}er")).collect();
    let too_many: Vec<&str> = too_many.iter().map(String::as_str).collect();
    assert!(validate_learning_paths(&settings(
        &too_many[..60],
        &[Tense::Present],
        None
    )));
    assert!(!validate_learning_paths(&settings(
        &too_many,
        &[Tense::Present],
        None
    )));
}

fn version_3(policy: PracticePolicy) -> PracticePolicy {
    PracticePolicy {
        algorithm_version: Some(ALGORITHM_VERSION_3.to_owned()),
        ..policy
    }
}

fn meadow(paths: LearningPathSettings) -> PracticePolicy {
    PracticePolicy {
        kind: Some(SessionKind::MeadowWatering),
        ..version_3(daily(paths))
    }
}

#[test]
fn with_two_gardens_the_daily_watering_leaves_the_verbs_to_the_meadow() {
    let snapshot = practised();
    let paths = settings(
        &["finir", "aller"],
        &[Tense::Present, Tense::Imperfect],
        None,
    );
    let focus = ConjugationFocus {
        tense: None,
        verb: "aller".to_owned(),
    };
    let in_class = settings(&["finir", "aller"], &[Tense::Present], Some(focus));
    for seed in 0..60 {
        for policy in [
            version_3(daily(paths.clone())),
            version_3(daily(in_class.clone())),
        ] {
            let watering = session(&snapshot, &policy, seed);
            assert_eq!(watering.kind, SessionKind::DailyWatering);
            assert!(!watering.questions.is_empty(), "seed {seed}");
            assert_eq!(conjugation_questions(&watering), 0, "seed {seed}");
        }
    }
}

#[test]
fn the_meadow_watering_asks_only_the_ticked_verbs() {
    let mut snapshot = practised();
    snapshot.facts.insert(
        "conj:finir:present".to_owned(),
        mastery(MasteryState::Familiar),
    );
    let policy = meadow(settings(
        &["finir", "aller", "venir"],
        &[Tense::Present, Tense::Future],
        None,
    ));
    for seed in 0..60 {
        let watering = session(&snapshot, &policy, seed);
        assert_eq!(watering.kind, SessionKind::MeadowWatering);
        let count = watering.questions.len();
        assert!((1..=8).contains(&count), "seed {seed}: {count}");
        assert_eq!(conjugation_questions(&watering), count, "seed {seed}");
    }
    // A child without verbs has no meadow watering.
    let empty = session(&snapshot, &meadow(LearningPathSettings::default()), 1);
    assert!(empty.questions.is_empty());
}

#[test]
fn the_meadow_watering_puts_the_verb_in_class_forward() {
    let mut snapshot = practised();
    for verb in ["venir", "faire"] {
        snapshot.facts.insert(
            format!("conj:{verb}:present"),
            mastery(MasteryState::Learning),
        );
    }
    let focus = ConjugationFocus {
        tense: None,
        verb: "venir".to_owned(),
    };
    let policy = meadow(settings(
        &["venir", "faire"],
        &[Tense::Present],
        Some(focus),
    ));
    for seed in 0..40 {
        let watering = session(&snapshot, &policy, seed);
        assert!(
            watering
                .questions
                .iter()
                .any(|question| question.fact_key == "conj:venir:present"),
            "seed {seed}"
        );
    }
}

#[test]
fn each_garden_blooms_once_a_day_from_its_own_watering() {
    let day = |key: &str, kind: SessionKind| SessionCompletionDay {
        learning_day_key: key.to_owned(),
        session_kind: Some(kind),
    };
    let completions = [
        day("2026-10-06", SessionKind::DailyWatering),
        day("2026-10-06", SessionKind::MeadowWatering),
        day("2026-10-07", SessionKind::MeadowWatering),
        day("2026-10-07", SessionKind::MeadowWatering),
        day("2026-10-08", SessionKind::ExtraPractice),
    ];
    let garden = derive_garden_reward_ledger(&completions, 0.0, &[]);
    assert_eq!(garden.garden_bloom_count, 1);
    assert_eq!(garden.rewarded_day_keys, ["2026-10-06"]);
    let meadow = derive_meadow_reward_ledger(&completions, 0.0, &[]);
    assert_eq!(meadow.garden_bloom_count, 2);
    assert_eq!(meadow.rewarded_day_keys, ["2026-10-06", "2026-10-07"]);
    // On the device, a new completion adds to what is known.
    let next = derive_meadow_reward_ledger(
        &[day("2026-10-08", SessionKind::MeadowWatering)],
        2.0,
        &meadow.rewarded_day_keys,
    );
    assert_eq!((next.garden_bloom_count, next.garden_blooms_earned), (3, 1));
}

proptest! {
    #[test]
    fn exercises_are_deterministic_and_well_formed(seed in any::<u32>(), recall in any::<bool>(), index in 0usize..12) {
        let verbs = ["finir", "aller", "être", "avoir", "apercevoir", "sourire", "essayer", "servir", "comprendre", "pleuvoir", "jeter", "manger"];
        let tense = Tense::ALL[index % 4];
        let key = format!("conj:{}:{}", verbs[index], tense.slug());
        let first = lt_domain::paths::generate_exercise(&key, &mut lt_domain::rng::Rng::new(seed), recall);
        let second = lt_domain::paths::generate_exercise(&key, &mut lt_domain::rng::Rng::new(seed), recall);
        prop_assert_eq!(&first, &second);
        let Some(Exercise::Conjugation(exercise)) = first else {
            return Err(TestCaseError::fail("no exercise"));
        };
        prop_assert!(lt_domain::conjugation::exercise::is_well_formed(&exercise));
        prop_assert_eq!(exercise.choices.is_empty(), recall);
    }
}

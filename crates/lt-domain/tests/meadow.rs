//! The verb meadow: stages, butterflies, thirst, the session visit and the flowers of each verb.

use lt_domain::conjugation::{VerbGroup, key};
use lt_domain::meadow::{
    MeadowInput, MeadowPalette, MeadowSilhouette, MeadowStage, assign_flowers, derive_meadow,
    group_silhouettes, meadow_visit, verb_flower, verb_hash,
};
use lt_domain::model::{
    AnswerMode, AttemptEvent, ConjugationSettings, FactMastery, LearningSnapshot, MasteryState,
    Tense,
};
use proptest::prelude::*;

const TODAY: &str = "2026-10-08";

fn settings(verbs: &[&str], tenses: &[Tense]) -> ConjugationSettings {
    ConjugationSettings {
        focus: None,
        tenses: tenses.to_vec(),
        verbs: verbs.iter().map(|verb| (*verb).to_owned()).collect(),
    }
}

fn fact(state: MasteryState, last: Option<&str>, successful: &[&str]) -> FactMastery {
    FactMastery {
        last_reviewed_day_key: last.map(str::to_owned),
        successful_day_keys: successful.iter().map(|day| (*day).to_owned()).collect(),
        state,
        ..FactMastery::empty()
    }
}

fn snapshot(facts: Vec<(String, FactMastery)>) -> LearningSnapshot {
    LearningSnapshot {
        facts: facts.into_iter().collect(),
        ..LearningSnapshot::default()
    }
}

fn meadow(
    settings: &ConjugationSettings,
    snapshot: &LearningSnapshot,
) -> lt_domain::meadow::MeadowProgress {
    derive_meadow(&MeadowInput {
        settings: Some(settings),
        snapshot,
        today_key: TODAY,
    })
}

fn attempt(fact_key: &str, correct: bool) -> AttemptEvent {
    AttemptEvent {
        answer_mode: AnswerMode::Keypad,
        answered_at: 0,
        choices: Vec::new(),
        correct,
        event_id: String::new(),
        exercise: None,
        fact_key: fact_key.to_owned(),
        latency_ms: 0.0,
        learning_day_key: None,
        left: 0,
        operation: None,
        response: None,
        right: 0,
        question_count: 6,
        selected: 0,
        sequence: 0,
        session_id: String::new(),
        session_kind: None,
        algorithm_version: None,
    }
}

#[test]
fn hashes_infinitives_with_fnv_1a() {
    assert_eq!(verb_hash("être"), 2_660_858_357);
    assert_eq!(verb_hash("aller"), 2_878_868_371);
    assert_eq!(verb_hash("finir"), 730_291_617);
}

#[test]
fn draws_each_group_from_its_own_silhouettes() {
    assert_eq!(
        verb_flower(VerbGroup::Auxiliary, "être"),
        (MeadowSilhouette::Tulip, MeadowPalette::Indigo)
    );
    assert_eq!(
        verb_flower(VerbGroup::Third, "aller"),
        (MeadowSilhouette::Anemone, MeadowPalette::Gold)
    );
    assert_eq!(
        verb_flower(VerbGroup::Second, "finir"),
        (MeadowSilhouette::Dahlia, MeadowPalette::Coral)
    );
    let progress = meadow(
        &settings(
            &["finir", "aller", "chanter", "avoir", "être"],
            &[Tense::Present],
        ),
        &LearningSnapshot::default(),
    );
    for verb in &progress.verbs {
        assert!(group_silhouettes(verb.group).contains(&verb.silhouette));
    }
}

#[test]
fn sorts_verbs_by_group_then_in_the_parent_order() {
    let progress = meadow(
        &settings(
            &[
                "finir",
                "aller",
                "chanter",
                "avoir",
                "être",
                "danser",
                "inconnuxyz",
            ],
            &[Tense::Present],
        ),
        &LearningSnapshot::default(),
    );
    let names: Vec<&str> = progress.verbs.iter().map(|v| v.verb.as_str()).collect();
    assert_eq!(
        names,
        ["avoir", "être", "chanter", "danser", "finir", "aller"]
    );
}

#[test]
fn grows_from_seed_to_mature_with_the_ticked_tenses() {
    let tenses = [Tense::Future, Tense::Present];
    let stage = |present: MasteryState, future: MasteryState| {
        let progress = meadow(
            &settings(&["chanter"], &tenses),
            &snapshot(vec![
                (key("chanter", Tense::Present), fact(present, None, &[])),
                (key("chanter", Tense::Future), fact(future, None, &[])),
                // An unticked tense never counts.
                (
                    key("chanter", Tense::Imperfect),
                    fact(MasteryState::Learning, None, &[]),
                ),
            ]),
        );
        progress.verbs[0].stage
    };
    assert_eq!(
        stage(MasteryState::Unseen, MasteryState::Unseen),
        MeadowStage::Seed
    );
    assert_eq!(
        stage(MasteryState::Learning, MasteryState::Unseen),
        MeadowStage::Growing
    );
    assert_eq!(
        stage(MasteryState::Fluent, MasteryState::Familiar),
        MeadowStage::Growing
    );
    assert_eq!(
        stage(MasteryState::Fluent, MasteryState::Fluent),
        MeadowStage::Mature
    );
    let progress = meadow(
        &settings(&["chanter"], &tenses),
        &LearningSnapshot::default(),
    );
    let order: Vec<Tense> = progress.verbs[0].tenses.iter().map(|t| t.tense).collect();
    assert_eq!(order, tenses);
}

#[test]
fn lands_butterflies_on_the_days_of_the_last_week() {
    let progress = meadow(
        &settings(&["aller", "finir"], &[Tense::Present, Tense::Future]),
        &snapshot(vec![
            (
                key("aller", Tense::Present),
                fact(
                    MasteryState::Learning,
                    Some("2026-10-08"),
                    &["2026-09-30", "2026-10-02", "2026-10-08"],
                ),
            ),
            (
                key("aller", Tense::Future),
                fact(MasteryState::Learning, Some("2026-10-08"), &["2026-10-08"]),
            ),
            // An unticked tense brings no butterfly.
            (
                key("finir", Tense::Imperfect),
                fact(MasteryState::Learning, Some("2026-10-07"), &["2026-10-07"]),
            ),
        ]),
    );
    let aller = progress.verbs.iter().find(|v| v.verb == "aller").unwrap();
    let finir = progress.verbs.iter().find(|v| v.verb == "finir").unwrap();
    assert_eq!(aller.butterfly_day_keys, ["2026-10-02", "2026-10-08"]);
    assert!(finir.butterfly_day_keys.is_empty());
    assert_eq!(progress.butterflies_this_week, 2);
}

#[test]
fn thirsts_after_three_days_and_names_the_oldest_verb() {
    let verbs = settings(&["chanter", "aller", "finir"], &[Tense::Present]);
    let seen = |aller: &str, finir: &str| {
        snapshot(vec![
            (
                key("aller", Tense::Present),
                fact(MasteryState::Learning, Some(aller), &[]),
            ),
            (
                key("finir", Tense::Present),
                fact(MasteryState::Learning, Some(finir), &[]),
            ),
        ])
    };
    assert_eq!(
        meadow(&verbs, &seen("2026-10-06", "2026-10-01")).thirst,
        None
    );
    let thirst = meadow(&verbs, &seen("2026-10-05", "2026-10-01"))
        .thirst
        .unwrap();
    assert_eq!((thirst.verb.as_str(), thirst.days_since), ("finir", 7));

    let never = meadow(&verbs, &LearningSnapshot::default()).thirst.unwrap();
    assert_eq!((never.verb.as_str(), never.days_since), ("chanter", 0));

    let none = derive_meadow(&MeadowInput {
        settings: None,
        snapshot: &LearningSnapshot::default(),
        today_key: TODAY,
    });
    assert!(none.verbs.is_empty() && none.thirst.is_none());
    assert!(
        meadow(
            &settings(&[], &[Tense::Present]),
            &LearningSnapshot::default()
        )
        .thirst
        .is_none()
    );
}

#[test]
fn a_session_visits_the_verb_with_three_correct_answers() {
    let present = key("aller", Tense::Present);
    let future = key("aller", Tense::Future);
    assert_eq!(
        meadow_visit(&[
            attempt(&present, true),
            attempt(&future, true),
            attempt(&present, false),
            attempt("3x4", true),
            attempt(&present, true),
        ]),
        Some("aller".to_owned())
    );
    assert_eq!(
        meadow_visit(&[
            attempt(&present, true),
            attempt(&present, true),
            attempt(&present, false),
        ]),
        None
    );
    let finir = key("finir", Tense::Present);
    let mut attempts: Vec<AttemptEvent> = (0..3).map(|_| attempt(&present, true)).collect();
    attempts.extend((0..4).map(|_| attempt(&finir, true)));
    assert_eq!(meadow_visit(&attempts), Some("finir".to_owned()));
}

fn group() -> impl Strategy<Value = VerbGroup> {
    prop_oneof![
        Just(VerbGroup::Auxiliary),
        Just(VerbGroup::First),
        Just(VerbGroup::Second),
        Just(VerbGroup::Third),
    ]
}

proptest! {
    #[test]
    fn two_verbs_of_a_small_group_never_share_a_flower(
        group in group(),
        verbs in prop::collection::hash_set("[a-zéèêîô]{2,12}", 1..10),
    ) {
        let verbs: Vec<String> = verbs.into_iter().collect();
        let flowers = assign_flowers(group, &verbs);
        for (index, flower) in flowers.iter().enumerate() {
            prop_assert!(group_silhouettes(group).contains(&flower.0));
            prop_assert!(!flowers[index + 1..].contains(flower));
        }
    }
}

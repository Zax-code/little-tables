//! The verb meadow: stages, life cycles, thirst, a session's change and the flowers of each verb.

use lt_domain::conjugation::{VerbGroup, key};
use lt_domain::day_key::shift_day_key;
use lt_domain::meadow::{
    MEADOW_CYCLE_START, MeadowInput, MeadowLife, MeadowPalette, MeadowSilhouette, MeadowStage,
    assign_flowers, derive_meadow, group_silhouettes, meadow_change, verb_cycle, verb_flower,
    verb_hash,
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

fn days(keys: &[&str]) -> Vec<String> {
    keys.iter().map(|day| (*day).to_owned()).collect()
}

#[test]
fn grows_a_butterfly_over_worked_days_and_a_chrysalis_wait() {
    let lives = |keys: &[&str]| verb_cycle("aller", &days(keys)).life;
    assert_eq!(lives(&[]), MeadowLife::Empty);
    assert_eq!(lives(&["2026-10-12"]), MeadowLife::Eggs);
    assert_eq!(
        lives(&["2026-10-12", "2026-10-13"]),
        MeadowLife::Caterpillar
    );
    assert_eq!(
        lives(&["2026-10-12", "2026-10-13", "2026-10-15"]),
        MeadowLife::BigCaterpillar
    );
    let chrysalis = ["2026-10-12", "2026-10-13", "2026-10-15", "2026-10-16"];
    assert_eq!(lives(&chrysalis), MeadowLife::Chrysalis);

    // Two days after the chrysalis, it still waits.
    let waiting = verb_cycle("aller", &days(&[&chrysalis[..], &["2026-10-18"]].concat()));
    assert_eq!(waiting.life, MeadowLife::Chrysalis);
    assert!(waiting.butterflies.is_empty());

    // Three days after, the next worked day lets the butterfly out.
    let out = verb_cycle(
        "aller",
        &days(&[&chrysalis[..], &["2026-10-18", "2026-10-19"]].concat()),
    );
    assert_eq!(out.life, MeadowLife::Empty);
    assert_eq!(out.butterflies.len(), 1);
    assert_eq!(out.butterflies[0].day_key, "2026-10-19");

    // The next worked day lays eggs again.
    let again = verb_cycle(
        "aller",
        &days(&[&chrysalis[..], &["2026-10-19", "2026-10-20"]].concat()),
    );
    assert_eq!(again.life, MeadowLife::Eggs);
    assert_eq!(again.butterflies.len(), 1);
}

#[test]
fn counts_no_day_before_the_cycles_start() {
    let before = shift_day_key(MEADOW_CYCLE_START, -1);
    let cycle = verb_cycle(
        "aller",
        &days(&[
            "2026-09-01",
            "2026-09-02",
            "2026-09-03",
            "2026-09-04",
            "2026-09-08",
            &before,
        ]),
    );
    assert_eq!(cycle.life, MeadowLife::Empty);
    assert!(cycle.butterflies.is_empty());
    assert_eq!(
        verb_cycle("aller", &days(&[MEADOW_CYCLE_START])).life,
        MeadowLife::Eggs
    );
}

#[test]
fn shows_each_verbs_cycle_from_all_its_tenses() {
    let progress = meadow(
        &settings(&["aller", "finir"], &[Tense::Present]),
        &snapshot(vec![
            (
                key("aller", Tense::Present),
                fact(
                    MasteryState::Learning,
                    Some("2026-10-14"),
                    &["2026-10-12", "2026-10-14"],
                ),
            ),
            // An unticked tense still feeds the caterpillar: unticking never takes a step back.
            (
                key("aller", Tense::Future),
                fact(
                    MasteryState::Learning,
                    Some("2026-10-14"),
                    &["2026-10-13", "2026-10-14"],
                ),
            ),
        ]),
    );
    let aller = progress.verbs.iter().find(|v| v.verb == "aller").unwrap();
    let finir = progress.verbs.iter().find(|v| v.verb == "finir").unwrap();
    assert_eq!(aller.life, MeadowLife::BigCaterpillar);
    assert_eq!(aller.last_worked_day_key.as_deref(), Some("2026-10-14"));
    assert_eq!(finir.life, MeadowLife::Empty);
    assert_eq!(finir.last_worked_day_key, None);
    assert_eq!(progress.butterflies, 0);
}

#[test]
fn keeps_every_butterfly_and_counts_them() {
    let worked = [
        "2026-10-12",
        "2026-10-13",
        "2026-10-14",
        "2026-10-15",
        "2026-10-18",
        "2026-10-19",
        "2026-10-20",
        "2026-10-21",
        "2026-10-22",
        "2026-10-25",
    ];
    let progress = meadow(
        &settings(&["aller"], &[Tense::Present]),
        &snapshot(vec![(
            key("aller", Tense::Present),
            fact(MasteryState::Familiar, Some("2026-10-25"), &worked),
        )]),
    );
    let aller = &progress.verbs[0];
    let out: Vec<&str> = aller
        .butterflies
        .iter()
        .map(|b| b.day_key.as_str())
        .collect();
    assert_eq!(out, ["2026-10-18", "2026-10-25"]);
    assert_ne!(aller.butterflies[0].species, aller.butterflies[1].species);
    assert_eq!(progress.butterflies, 2);
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

fn worked(verb: &str, keys: &[&str]) -> (String, FactMastery) {
    (
        key(verb, Tense::Present),
        fact(MasteryState::Learning, keys.last().copied(), keys),
    )
}

#[test]
fn a_session_names_its_furthest_change() {
    let aller = key("aller", Tense::Present);
    let finir = key("finir", Tense::Present);
    let attempts = [
        attempt(&aller, true),
        attempt("3x4", true),
        attempt(&finir, false),
    ];
    let before = snapshot(vec![
        worked("aller", &["2026-10-12"]),
        worked("finir", &["2026-10-12", "2026-10-13", "2026-10-14"]),
    ]);
    let after = snapshot(vec![
        worked("aller", &["2026-10-12", "2026-10-15"]),
        worked(
            "finir",
            &["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"],
        ),
    ]);
    let change = meadow_change(&attempts, &before, &after).unwrap();
    assert_eq!(
        (change.verb.as_str(), change.life),
        ("finir", MeadowLife::Chrysalis)
    );
    assert!(change.butterfly.is_none());

    // A second session the same day changes nothing.
    assert_eq!(meadow_change(&attempts, &after, &after), None);
    assert_eq!(meadow_change(&[], &before, &after), None);
}

#[test]
fn a_session_lets_a_butterfly_out_before_any_other_step() {
    let attempts = [
        attempt(&key("aller", Tense::Present), true),
        attempt(&key("finir", Tense::Present), true),
    ];
    let chrysalis = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
    let before = snapshot(vec![
        worked("aller", &["2026-10-12", "2026-10-13", "2026-10-14"]),
        worked("finir", &chrysalis),
    ]);
    let after = snapshot(vec![
        worked(
            "aller",
            &["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-18"],
        ),
        worked("finir", &[&chrysalis[..], &["2026-10-18"]].concat()),
    ]);
    let change = meadow_change(&attempts, &before, &after).unwrap();
    assert_eq!(
        (change.verb.as_str(), change.life),
        ("finir", MeadowLife::Empty)
    );
    assert_eq!(change.butterfly.unwrap().day_key, "2026-10-18");
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

    #[test]
    fn a_new_worked_day_never_takes_a_step_back(
        gaps in prop::collection::vec(1i64..5, 0..40),
        next in 1i64..5,
    ) {
        let mut day = MEADOW_CYCLE_START.to_owned();
        let mut worked = Vec::new();
        for gap in &gaps {
            worked.push(day.clone());
            day = shift_day_key(&day, *gap);
        }
        let old = verb_cycle("aller", &worked);
        let last = worked.last().cloned().unwrap_or_else(|| shift_day_key(MEADOW_CYCLE_START, -next));
        worked.push(shift_day_key(&last, next));
        let new = verb_cycle("aller", &worked);
        prop_assert!((new.butterflies.len(), new.life) >= (old.butterflies.len(), old.life)
            || (new.butterflies.len() == old.butterflies.len() + 1 && new.life == MeadowLife::Empty));
        prop_assert!(new.butterflies.len() <= old.butterflies.len() + 1);
        prop_assert_eq!(&new.butterflies[..old.butterflies.len()], &old.butterflies[..]);
        // Five worked days at least make a butterfly, and they never repeat a species in a row.
        prop_assert!(new.butterflies.len() * 5 <= worked.len());
        for pair in new.butterflies.windows(2) {
            prop_assert_ne!(pair[0].species, pair[1].species);
        }
    }
}

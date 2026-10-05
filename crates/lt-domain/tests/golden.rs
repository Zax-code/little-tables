//! Replays the golden vectors produced by `tools/golden` from the previous TypeScript engine.
//! Every value must match exactly; numbers are compared by value (`3` equals `3.0`).

use std::fs::File;
use std::io::Read;
use std::path::Path;

use flate2::read::GzDecoder;
use lt_domain::day_key::{DayKeys, IanaDayKeys};
use lt_domain::engine::{
    LearnerAnswer, SessionInput, answer, create_session, derive_learning_progress,
    derive_rescue_strategies, derive_session_insight, reduce, validate_exercise_attempt,
};
use lt_domain::exercises::{
    expected_answer, is_exercise_answer_correct, is_exercise_well_formed, is_production_exercise,
};
use lt_domain::garden::{
    GardenInput, LedgerTotals, SessionCompletionDay, derive_garden_progress,
    derive_garden_reward_ledger, derive_rewards, merge_garden_reward_ledgers,
};
use lt_domain::model::{
    AnswerMode, AttemptEvent, LearningPathSettings, LearningSnapshot, PracticeAnswer,
    PracticePolicy, PracticeQuestion, PracticeSession,
};
use lt_domain::paths::{
    count_borrows, count_carries, derive_open_skills, derive_path_progress, generate_exercise,
    interaction_family, skill_weight,
};
use lt_domain::rhythm::{ActiveSessionProgress, derive_practice_rhythm};
use lt_domain::rng::Rng;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

fn load(name: &str) -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(format!("tests/golden/{name}.json.gz"));
    let mut json = String::new();
    GzDecoder::new(File::open(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display())))
        .read_to_string(&mut json)
        .expect("golden files are gzip JSON");
    serde_json::from_str(&json).expect("golden files are JSON")
}

fn decode<T: DeserializeOwned>(value: &Value) -> T {
    serde_json::from_value(value.clone())
        .unwrap_or_else(|error| panic!("cannot decode {value}: {error}"))
}

/// Compares an actual value with the expected one and returns the path of the first difference.
fn difference(actual: &Value, expected: &Value, path: &str) -> Option<String> {
    match (actual, expected) {
        (Value::Number(first), Value::Number(second)) => {
            let (first, second) = (first.as_f64()?, second.as_f64()?);
            (first != second).then(|| format!("{path}: {first} ≠ expected {second}"))
        }
        (Value::Array(first), Value::Array(second)) => {
            if first.len() != second.len() {
                return Some(format!(
                    "{path}: length {} ≠ expected {}\n  actual   {actual}\n  expected {expected}",
                    first.len(),
                    second.len()
                ));
            }
            first
                .iter()
                .zip(second)
                .enumerate()
                .find_map(|(index, (first, second))| {
                    difference(first, second, &format!("{path}[{index}]"))
                })
        }
        (Value::Object(first), Value::Object(second)) => {
            for key in second.keys() {
                if !first.contains_key(key) {
                    return Some(format!("{path}.{key}: missing (expected {})", second[key]));
                }
            }
            for key in first.keys() {
                if !second.contains_key(key) {
                    return Some(format!("{path}.{key}: unexpected {}", first[key]));
                }
            }
            second
                .iter()
                .find_map(|(key, value)| difference(&first[key], value, &format!("{path}.{key}")))
        }
        _ => (actual != expected).then(|| format!("{path}: {actual} ≠ expected {expected}")),
    }
}

#[track_caller]
fn assert_same<T: Serialize>(actual: &T, expected: &Value, context: &str) {
    let actual = serde_json::to_value(actual).expect("engine values serialise");
    if let Some(found) = difference(&actual, expected, "$") {
        panic!("{context}\n{found}");
    }
}

#[test]
fn random_generator_matches() {
    for vector in load("rng").as_array().unwrap() {
        let mut random = Rng::new(vector["seed"].as_u64().unwrap() as u32);
        let values: Vec<f64> = (0..32).map(|_| random.next()).collect();
        assert_same(
            &values,
            &vector["values"],
            &format!("seed {}", vector["seed"]),
        );
    }
}

#[test]
fn day_keys_match_intl() {
    for vector in load("day-keys").as_array().unwrap() {
        let at = vector["at"].as_i64().unwrap();
        let zone = vector["timeZone"].as_str().unwrap();
        assert_eq!(
            IanaDayKeys.day_key(at, zone),
            vector["dayKey"].as_str().unwrap(),
            "{at} in {zone}"
        );
    }
}

#[test]
fn exercises_match() {
    let vectors = load("exercises");
    let vectors = vectors.as_array().unwrap();
    assert!(vectors.len() > 1000);
    for vector in vectors {
        let key = vector["key"].as_str().unwrap();
        let recall = vector["recall"].as_bool().unwrap();
        let seed = vector["seed"].as_u64().unwrap() as u32;
        let context = format!("{key} recall={recall} seed={seed}");
        let mut random = Rng::new(seed);
        let exercise =
            generate_exercise(key, &mut random, recall).expect("every level has a generator");
        assert_same(&exercise, &vector["exercise"], &context);
        assert_same(
            &random.next(),
            &vector["nextRandom"],
            &format!("{context}: draws consumed"),
        );
        assert_same(&expected_answer(&exercise), &vector["expected"], &context);
        assert_same(
            &is_production_exercise(&exercise),
            &vector["production"],
            &context,
        );
        assert_same(
            &is_exercise_well_formed(&exercise),
            &vector["wellFormed"],
            &context,
        );
        assert_same(&interaction_family(key), &vector["family"], &context);
        assert_same(&skill_weight(key), &vector["weight"], &context);
        for answer in vector["answers"].as_array().unwrap() {
            let response: PracticeAnswer = decode(&answer["answer"]);
            assert_same(
                &is_exercise_answer_correct(&exercise, &response),
                &answer["correct"],
                &format!("{context}: answer {}", answer["answer"]),
            );
        }
    }
}

#[test]
fn column_counts_match() {
    for vector in load("columns").as_array().unwrap() {
        let first = vector["first"].as_i64().unwrap();
        let second = vector["second"].as_i64().unwrap();
        let third = vector["third"].as_i64().unwrap();
        assert_same(
            &count_borrows(first, second),
            &vector["borrows"],
            &format!("{vector}"),
        );
        assert_same(
            &count_carries(&[first, second]),
            &vector["carries2"],
            &format!("{vector}"),
        );
        assert_same(
            &count_carries(&[first, second, third]),
            &vector["carries3"],
            &format!("{vector}"),
        );
    }
}

#[test]
fn rhythm_matches() {
    for vector in load("rhythm").as_array().unwrap() {
        let input = &vector["input"];
        let active: Option<ActiveSessionProgress> = decode(&input["activeSession"]);
        let rhythm = derive_practice_rhythm(
            active.as_ref(),
            &decode::<Vec<String>>(&input["practiceDayKeys"]),
            &decode::<Vec<String>>(&input["rewardedDayKeys"]),
            input["todayKey"].as_str().unwrap(),
        );
        assert_same(&rhythm, &vector["expect"], &format!("{input}"));
    }
}

fn completions_of(value: &Value) -> Vec<SessionCompletionDay> {
    decode(value)
}

#[test]
fn ledger_matches() {
    for vector in load("ledger").as_array().unwrap() {
        let input = &vector["input"];
        let ledger = derive_garden_reward_ledger(
            &completions_of(&input["completions"]),
            input["gardenBloomCount"].as_f64().unwrap_or(0.0),
            &input
                .get("rewardedDayKeys")
                .map(decode::<Vec<String>>)
                .unwrap_or_default(),
        );
        assert_same(&ledger, &vector["expect"], &format!("{input}"));
        let merged: Vec<LedgerTotals> = decode(&vector["merged"]["ledgers"]);
        assert_same(
            &merge_garden_reward_ledgers(&merged),
            &vector["expectMerged"],
            &format!("{}", vector["merged"]),
        );
    }
}

fn garden_input<'a>(
    value: &Value,
    snapshot: &'a LearningSnapshot,
    awarded: &'a Option<Vec<String>>,
    order: &'a Option<Vec<String>>,
) -> GardenInput<'a> {
    GardenInput {
        awarded_flower_ids: awarded.as_deref(),
        completed_sessions: value["completedSessions"].as_f64().unwrap_or(f64::NAN),
        flower_order: order.as_deref(),
        snapshot,
    }
}

#[test]
fn garden_matches() {
    for vector in load("garden").as_array().unwrap() {
        let input = &vector["input"];
        let snapshot: LearningSnapshot = decode(&input["snapshot"]);
        let awarded: Option<Vec<String>> = input.get("awardedFlowerIds").map(decode);
        let order: Option<Vec<String>> = input.get("flowerOrder").map(decode);
        let garden = garden_input(input, &snapshot, &awarded, &order);
        let context = format!(
            "completed={} awarded={awarded:?} order={order:?}",
            input["completedSessions"]
        );
        assert_same(
            &derive_garden_progress(&garden),
            &vector["expect"],
            &context,
        );
        let rewards = derive_rewards(&GardenInput {
            completed_sessions: if garden.completed_sessions.is_nan() {
                0.0
            } else {
                garden.completed_sessions
            },
            ..garden
        });
        assert_same(&rewards, &vector["expectRewards"], &context);
    }
}

fn tamperings(event: &AttemptEvent) -> Vec<AttemptEvent> {
    let mut flipped = event.clone();
    flipped.correct = !event.correct;
    let mut mode = event.clone();
    mode.answer_mode = match event.answer_mode {
        AnswerMode::Keypad => AnswerMode::Choice,
        AnswerMode::Choice => AnswerMode::Keypad,
    };
    let mut choices = event.clone();
    choices.choices = vec![1, 2, 3];
    let mut sequence = event.clone();
    sequence.sequence = event.question_count;
    let mut key = event.clone();
    key.fact_key = if event.fact_key.starts_with("add:") {
        "add:9:9".to_owned()
    } else {
        format!("{}x", event.fact_key)
    };
    vec![event.clone(), flipped, mode, choices, sequence, key]
}

fn replay(name: &str) {
    let scenario = load(&format!("scenario-{name}"));
    let day_keys = IanaDayKeys;
    let mut snapshot = LearningSnapshot::default();
    let mut session: Option<PracticeSession> = None;
    let mut events: Vec<AttemptEvent> = Vec::new();
    let mut checked = 0;

    for (index, step) in scenario["steps"].as_array().unwrap().iter().enumerate() {
        let context = format!("{name} step {index} ({})", step["op"]);
        match step["op"].as_str().unwrap() {
            "createSession" => {
                let policy: PracticePolicy = decode(&step["policy"]);
                let created = create_session(
                    &SessionInput {
                        now: step["now"].as_i64().unwrap(),
                        seed: step["seed"].as_u64().unwrap() as u32,
                        snapshot: &snapshot,
                        time_zone: step["timeZone"].as_str().unwrap(),
                    },
                    &policy,
                    &day_keys,
                );
                assert_same(&created, &step["expect"], &context);
                session = Some(created);
                events.clear();
            }
            "answer" => {
                let current = session.as_ref().expect("a session is running");
                let learner = match step.get("response") {
                    Some(response) => LearnerAnswer::Response(decode(response)),
                    None => LearnerAnswer::Selected(step["selected"].as_i64().unwrap()),
                };
                let outcome = answer(
                    current,
                    &learner,
                    step["answeredAt"].as_i64().unwrap(),
                    step["eventId"].as_str().unwrap(),
                    &day_keys,
                )
                .expect("the question exists");
                let expect = &step["expect"];
                assert_same(&outcome.correct, &expect["correct"], &context);
                assert_same(
                    &outcome.session.current_index,
                    &expect["currentIndex"],
                    &context,
                );
                assert_same(&outcome.event, &expect["event"], &context);
                let ids: Vec<&str> = outcome
                    .session
                    .questions
                    .iter()
                    .map(|question| question.id.as_str())
                    .collect();
                assert_same(&ids, &expect["questionIds"], &context);
                events.push(outcome.event);
                session = Some(outcome.session);
            }
            "rescue" => {
                let question: PracticeQuestion = decode(&step["question"]);
                assert_same(
                    &derive_rescue_strategies(&question, &snapshot),
                    &step["expect"],
                    &context,
                );
            }
            "reduce" => {
                let zone = step["timeZone"].as_str().unwrap();
                let insight = derive_session_insight(&events, &snapshot, zone, &day_keys);
                assert_same(&insight, &step["expectInsight"], &context);
                snapshot = reduce(&snapshot, &events, zone, &day_keys);
            }
            "validate" => {
                let results: Vec<bool> = events
                    .iter()
                    .flat_map(|event| {
                        tamperings(event)
                            .into_iter()
                            .map(|candidate| validate_exercise_attempt(&candidate))
                    })
                    .collect();
                assert_same(&results, &step["expect"], &context);
            }
            "derive" => {
                assert_same(
                    &snapshot,
                    &step["snapshot"],
                    &format!("{context}: snapshot"),
                );
                let expect = &step["expect"];
                let paths: LearningPathSettings = decode(&step["paths"]);
                let progress = derive_learning_progress(&snapshot, None);
                let full = derive_learning_progress(
                    &snapshot,
                    Some(&decode(&serde_json::json!({
                        "packs": ["core", "bonus-11-12", "inverse-division"],
                        "paths": step["paths"],
                    }))),
                );
                assert_same(
                    &vec![&progress, &full],
                    &expect["progress"],
                    &format!("{context}: progress"),
                );
                assert_same(
                    &derive_open_skills(&snapshot.facts, &paths, progress.packs.bonus1112.unlocked),
                    &expect["openSkills"],
                    &format!("{context}: open skills"),
                );
                assert_same(
                    &derive_path_progress(&snapshot.facts, &paths, false),
                    &expect["pathProgress"],
                    &format!("{context}: path progress"),
                );
                let ledger =
                    derive_garden_reward_ledger(&completions_of(&step["completions"]), 0.0, &[]);
                assert_same(&ledger, &expect["ledger"], &format!("{context}: ledger"));
                let awarded: Option<Vec<String>> =
                    step["garden"].get("awardedFlowerIds").map(decode);
                let order: Option<Vec<String>> = step["garden"].get("flowerOrder").map(decode);
                let garden = garden_input(&step["garden"], &snapshot, &awarded, &order);
                assert_same(
                    &derive_garden_progress(&garden),
                    &expect["garden"],
                    &format!("{context}: garden"),
                );
                assert_same(
                    &derive_rewards(&garden),
                    &expect["rewards"],
                    &format!("{context}: rewards"),
                );
                let rhythm = &step["rhythmInput"];
                let active: Option<ActiveSessionProgress> = decode(&rhythm["activeSession"]);
                assert_same(
                    &derive_practice_rhythm(
                        active.as_ref(),
                        &decode::<Vec<String>>(&rhythm["practiceDayKeys"]),
                        &decode::<Vec<String>>(&rhythm["rewardedDayKeys"]),
                        rhythm["todayKey"].as_str().unwrap(),
                    ),
                    &expect["rhythm"],
                    &format!("{context}: rhythm"),
                );
                checked += 1;
            }
            other => panic!("unknown step {other}"),
        }
    }
    assert!(checked > 0, "{name} has derive checkpoints");
}

#[test]
fn scenario_tables_paris() {
    replay("tables-paris");
}

#[test]
fn scenario_all_paths_new_york() {
    replay("all-paths-new-york");
}

#[test]
fn scenario_focus_shanghai() {
    replay("focus-shanghai");
}

#[test]
fn scenario_struggling_auckland() {
    replay("struggling-auckland");
}

#[test]
fn scenario_advanced_utc() {
    replay("advanced-utc");
}

#[test]
fn scenario_fractions_los_angeles() {
    replay("fractions-los-angeles");
}

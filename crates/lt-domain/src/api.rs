//! One JSON entry point for every engine operation, used by the WebAssembly build.
//!
//! Each operation takes one JSON object and returns one JSON value. Field names follow the
//! TypeScript client; instants are Unix milliseconds.

use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use crate::day_key::DayKeys;
use crate::engine::{
    LearnerAnswer, SessionInput, answer, correct_answer, create_session,
    derive_curriculum_pack_progress, derive_learning_progress, derive_rescue_strategies,
    derive_session_insight, empty_snapshot, reduce, validate_exercise_attempt,
};
use crate::exercises::{
    column_result, equal_option_indexes, expected_answer, fraction_operation_result,
    is_exercise_answer_correct, is_production_exercise, line_tick_index,
};
use crate::garden::{
    GardenInput, LedgerTotals, SessionCompletionDay, derive_garden_progress,
    derive_garden_reward_ledger, derive_rewards, garden_flower_ids, merge_garden_reward_ledgers,
};
use crate::model::{
    AttemptEvent, CurriculumPolicy, Exercise, LearningPathSettings, LearningSnapshot, Millis,
    PracticeAnswer, PracticePolicy, PracticeQuestion, PracticeSession,
};
use crate::paths::{derive_open_skills, derive_path_progress};
use crate::rhythm::{ActiveSessionProgress, derive_practice_rhythm};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSession {
    now: Millis,
    policy: PracticePolicy,
    seed: u32,
    snapshot: LearningSnapshot,
    #[serde(default = "utc")]
    time_zone: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Answer {
    answered_at: Millis,
    event_id: String,
    #[serde(default)]
    response: Option<PracticeAnswer>,
    #[serde(default)]
    selected: Option<i64>,
    session: PracticeSession,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Reduce {
    attempts: Vec<AttemptEvent>,
    snapshot: LearningSnapshot,
    #[serde(default = "utc")]
    time_zone: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LearningProgressInput {
    #[serde(default)]
    curriculum: Option<CurriculumPolicy>,
    snapshot: LearningSnapshot,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RhythmInput {
    active_session: Option<ActiveSessionProgress>,
    practice_day_keys: Vec<String>,
    rewarded_day_keys: Vec<String>,
    today_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LedgerInput {
    completions: Vec<SessionCompletionDay>,
    #[serde(default)]
    garden_bloom_count: Option<f64>,
    #[serde(default)]
    rewarded_day_keys: Vec<String>,
}

#[derive(Deserialize)]
struct MergeInput {
    ledgers: Vec<LedgerTotals>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GardenData {
    #[serde(default)]
    awarded_flower_ids: Option<Vec<String>>,
    completed_sessions: Option<f64>,
    #[serde(default)]
    flower_order: Option<Vec<String>>,
    snapshot: LearningSnapshot,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InsightInput {
    attempts: Vec<AttemptEvent>,
    snapshot: LearningSnapshot,
    #[serde(default = "utc")]
    time_zone: String,
}

#[derive(Deserialize)]
struct RescueInput {
    question: PracticeQuestion,
    snapshot: LearningSnapshot,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathsInput {
    settings: LearningPathSettings,
    snapshot: LearningSnapshot,
    tables_acquired: bool,
}

#[derive(Deserialize)]
struct ExerciseAnswer {
    answer: PracticeAnswer,
    exercise: Exercise,
}

/// What an exercise screen shows besides the prompt: the answer, typed or chosen, and the
/// values the illustrations reveal once it is settled.
fn describe_exercise(exercise: &Exercise) -> Value {
    let mut description = json!({
        "expected": expected_answer(exercise),
        "production": is_production_exercise(exercise),
    });
    match exercise {
        Exercise::Column(column) => description["columnResult"] = json!(column_result(column)),
        Exercise::FractionLine(line) => description["tickIndex"] = json!(line_tick_index(line)),
        Exercise::FractionPick(pick) => {
            description["equalOptions"] = json!(equal_option_indexes(pick));
        }
        Exercise::FractionOperation(operation) => {
            description["operationResult"] = json!(fraction_operation_result(operation));
        }
        _ => {}
    }
    description
}

fn utc() -> String {
    "UTC".to_owned()
}

fn parse<T: DeserializeOwned>(input: Value) -> Result<T, String> {
    serde_json::from_value(input).map_err(|error| format!("invalid input: {error}"))
}

fn output<T: serde::Serialize>(value: &T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}

/// Runs one engine operation.
pub fn dispatch(operation: &str, input: Value, day_keys: &dyn DayKeys) -> Result<Value, String> {
    match operation {
        "emptySnapshot" => output(&empty_snapshot()),
        "createSession" => {
            let input: CreateSession = parse(input)?;
            output(&create_session(
                &SessionInput {
                    now: input.now,
                    seed: input.seed,
                    snapshot: &input.snapshot,
                    time_zone: &input.time_zone,
                },
                &input.policy,
                day_keys,
            ))
        }
        "answer" => {
            let input: Answer = parse(input)?;
            let learner = match (input.response, input.selected) {
                (Some(response), _) => LearnerAnswer::Response(response),
                (None, selected) => LearnerAnswer::Selected(selected.unwrap_or(0)),
            };
            let outcome = answer(
                &input.session,
                &learner,
                input.answered_at,
                &input.event_id,
                day_keys,
            )
            .map_err(|error| format!("{error:?}"))?;
            output(&outcome)
        }
        "reduce" => {
            let input: Reduce = parse(input)?;
            output(&reduce(
                &input.snapshot,
                &input.attempts,
                &input.time_zone,
                day_keys,
            ))
        }
        "validateExerciseAttempt" => {
            let attempt: AttemptEvent = parse(input)?;
            output(&validate_exercise_attempt(&attempt))
        }
        "correctAnswer" => {
            let question: PracticeQuestion = parse(input)?;
            output(&correct_answer(&question))
        }
        "expectedAnswer" => {
            let exercise: Exercise = parse(input)?;
            output(&expected_answer(&exercise))
        }
        "isExerciseAnswerCorrect" => {
            let input: ExerciseAnswer = parse(input)?;
            output(&is_exercise_answer_correct(&input.exercise, &input.answer))
        }
        "isProductionExercise" => {
            let exercise: Exercise = parse(input)?;
            output(&is_production_exercise(&exercise))
        }
        "describeExercise" => {
            let exercise: Exercise = parse(input)?;
            output(&describe_exercise(&exercise))
        }
        "deriveLearningProgress" => {
            let input: LearningProgressInput = parse(input)?;
            output(&derive_learning_progress(
                &input.snapshot,
                input.curriculum.as_ref(),
            ))
        }
        "deriveCurriculumPackProgress" => {
            let snapshot: LearningSnapshot = parse(input)?;
            output(&derive_curriculum_pack_progress(&snapshot))
        }
        "deriveOpenSkills" => {
            let input: PathsInput = parse(input)?;
            output(&derive_open_skills(
                &input.snapshot.facts,
                &input.settings,
                input.tables_acquired,
            ))
        }
        "derivePathProgress" => {
            let input: PathsInput = parse(input)?;
            output(&derive_path_progress(
                &input.snapshot.facts,
                &input.settings,
                input.tables_acquired,
            ))
        }
        "derivePracticeRhythm" => {
            let input: RhythmInput = parse(input)?;
            output(&derive_practice_rhythm(
                input.active_session.as_ref(),
                &input.practice_day_keys,
                &input.rewarded_day_keys,
                &input.today_key,
            ))
        }
        "deriveGardenRewardLedger" => {
            let input: LedgerInput = parse(input)?;
            output(&derive_garden_reward_ledger(
                &input.completions,
                input.garden_bloom_count.unwrap_or(0.0),
                &input.rewarded_day_keys,
            ))
        }
        "mergeGardenRewardLedgers" => {
            let input: MergeInput = parse(input)?;
            output(&merge_garden_reward_ledgers(&input.ledgers))
        }
        "deriveGardenProgress" | "deriveRewards" => {
            let data: GardenData = parse(input)?;
            let garden = GardenInput {
                awarded_flower_ids: data.awarded_flower_ids.as_deref(),
                completed_sessions: data.completed_sessions.unwrap_or(f64::NAN),
                flower_order: data.flower_order.as_deref(),
                snapshot: &data.snapshot,
            };
            if operation == "deriveRewards" {
                output(&derive_rewards(&garden))
            } else {
                output(&derive_garden_progress(&garden))
            }
        }
        "gardenFlowerIds" => output(&garden_flower_ids()),
        "deriveSessionInsight" => {
            let input: InsightInput = parse(input)?;
            output(&derive_session_insight(
                &input.attempts,
                &input.snapshot,
                &input.time_zone,
                day_keys,
            ))
        }
        "deriveRescueStrategies" => {
            let input: RescueInput = parse(input)?;
            output(&derive_rescue_strategies(&input.question, &input.snapshot))
        }
        "version" => Ok(json!({ "algorithmVersion": "1", "crate": env!("CARGO_PKG_VERSION") })),
        other => Err(format!("unknown operation {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::day_key::UtcDayKeys;

    #[test]
    fn creates_and_answers_a_session_through_json() {
        let session = dispatch(
            "createSession",
            json!({
                "now": 1_780_000_000_000_i64,
                "policy": { "kind": "daily-watering" },
                "seed": 7,
                "snapshot": dispatch("emptySnapshot", Value::Null, &UtcDayKeys).unwrap(),
            }),
            &UtcDayKeys,
        )
        .unwrap();
        let question: PracticeQuestion =
            serde_json::from_value(session["questions"][0].clone()).unwrap();
        let outcome = dispatch(
            "answer",
            json!({
                "answeredAt": 1_780_000_003_000_i64,
                "eventId": "e1",
                "selected": correct_answer(&question),
                "session": session,
            }),
            &UtcDayKeys,
        )
        .unwrap();
        assert_eq!(outcome["correct"], json!(true));
        assert_eq!(outcome["event"]["learningDayKey"], json!("2026-05-28"));
    }

    #[test]
    fn reports_unknown_operations_and_bad_input() {
        assert!(dispatch("nope", Value::Null, &UtcDayKeys).is_err());
        assert!(dispatch("reduce", json!({ "attempts": 3 }), &UtcDayKeys).is_err());
    }
}

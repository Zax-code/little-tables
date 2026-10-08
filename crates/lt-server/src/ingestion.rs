//! Attempt ingestion: decoding of the wire format and the server-side consistency rules.

use lt_domain::engine::{correct_answer, fact_key, validate_exercise_attempt};
use lt_domain::model::{
    AnswerMode, AttemptEvent, Exercise, Millis, PracticeAnswer, PracticeQuestion,
    QuestionOperation, SessionKind,
};
use lt_store::Store;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rejection {
    pub event_id: String,
    pub reason: &'static str,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub accepted: Vec<String>,
    pub duplicates: Vec<String>,
    pub rejected: Vec<Rejection>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WireAttempt {
    #[serde(default)]
    algorithm_version: Option<String>,
    answer_mode: AnswerMode,
    answered_at: Value,
    choices: Vec<i64>,
    correct: bool,
    event_id: String,
    #[serde(default)]
    exercise: Option<Value>,
    fact_key: String,
    latency_ms: f64,
    #[serde(default)]
    learning_day_key: Option<String>,
    left: i64,
    #[serde(default)]
    operation: Option<QuestionOperation>,
    question_count: i64,
    #[serde(default)]
    response: Option<Value>,
    right: i64,
    selected: i64,
    sequence: i64,
    session_id: String,
    #[serde(default)]
    session_kind: Option<SessionKind>,
}

/// Parses an instant the way `new Date(text)` reads what clients send: ISO 8601, or a bare date
/// (midnight UTC).
pub fn parse_instant(text: &str) -> Option<Millis> {
    if let Ok(instant) = chrono::DateTime::parse_from_rfc3339(text) {
        return Some(instant.timestamp_millis());
    }
    chrono::NaiveDate::parse_from_str(text, "%Y-%m-%d")
        .ok()
        .and_then(|date| date.and_hms_opt(0, 0, 0))
        .map(|instant| instant.and_utc().timestamp_millis())
}

fn is_day_key_shaped(key: &str) -> bool {
    key.len() == 10
        && key.bytes().enumerate().all(|(index, byte)| match index {
            4 | 7 => byte == b'-',
            _ => byte.is_ascii_digit(),
        })
}

/// Decodes one event and applies the schema rules of the wire format (instants in Unix ms).
pub fn decode_attempt(value: Value) -> Result<AttemptEvent, String> {
    let wire: WireAttempt = serde_json::from_value(value).map_err(|error| error.to_string())?;
    let answered_at = wire
        .answered_at
        .as_i64()
        .filter(|millis| *millis > 0)
        .ok_or("answeredAt is not a date")?;
    let whole = |value: f64| value >= 0.0 && value.fract() == 0.0 && value.is_finite();
    if wire.event_id.is_empty() || wire.fact_key.is_empty() || wire.session_id.is_empty() {
        return Err("identifiers must not be empty".to_owned());
    }
    if !whole(wire.latency_ms) || wire.selected < 0 || wire.sequence < 0 {
        return Err("latencyMs, selected and sequence must be non-negative integers".to_owned());
    }
    if !(1..=100).contains(&wire.question_count) {
        return Err("questionCount must be between 1 and 100".to_owned());
    }
    if wire
        .learning_day_key
        .as_deref()
        .is_some_and(|key| !is_day_key_shaped(key))
    {
        return Err("learningDayKey must look like YYYY-MM-DD".to_owned());
    }
    // Path attempts carry their exercise and answer and zero operands; anything else is decoded
    // as a fact attempt, which drops those fields.
    let path = match (&wire.exercise, &wire.response) {
        (Some(exercise), Some(response)) if wire.left == 0 && wire.right == 0 => {
            match (
                serde_json::from_value::<Exercise>(exercise.clone()),
                serde_json::from_value::<PracticeAnswer>(response.clone()),
            ) {
                (Ok(exercise), Ok(response)) => Some((exercise, response)),
                _ => None,
            }
        }
        _ => None,
    };
    if path.is_none() && !((1..=144).contains(&wire.left) && (1..=12).contains(&wire.right)) {
        return Err("left and right are out of range".to_owned());
    }
    let (exercise, response) = path.map_or((None, None), |(exercise, response)| {
        (Some(exercise), Some(response))
    });
    Ok(AttemptEvent {
        // The rules that composed the session; anything unknown is not kept.
        algorithm_version: wire.algorithm_version.filter(|version| {
            version == "1"
                || version == lt_domain::model::ALGORITHM_VERSION_2
                || version == lt_domain::model::ALGORITHM_VERSION_3
        }),
        answer_mode: wire.answer_mode,
        answered_at,
        choices: wire.choices,
        correct: wire.correct,
        event_id: wire.event_id,
        exercise,
        fact_key: wire.fact_key,
        latency_ms: wire.latency_ms,
        learning_day_key: wire.learning_day_key,
        left: wire.left,
        operation: Some(wire.operation.unwrap_or_default()),
        question_count: wire.question_count,
        response,
        right: wire.right,
        selected: wire.selected,
        sequence: wire.sequence,
        session_id: wire.session_id,
        session_kind: wire.session_kind,
    })
}

/// A learning day key that names a real calendar date.
fn valid_learning_day_key(attempt: &AttemptEvent) -> bool {
    attempt.learning_day_key.as_deref().is_none_or(|key| {
        chrono::NaiveDate::parse_from_str(key, "%Y-%m-%d")
            .is_ok_and(|date| date.format("%Y-%m-%d").to_string() == key)
    })
}

/// Why an attempt is refused, or `None` when it is consistent.
pub fn rejection_reason(attempt: &AttemptEvent) -> Option<&'static str> {
    if attempt.exercise.is_some() {
        return (!valid_learning_day_key(attempt) || !validate_exercise_attempt(attempt))
            .then_some("inconsistent_attempt");
    }
    let operation = attempt.operation.unwrap_or_default();
    let (left, right) = (attempt.left, attempt.right);
    let valid_operands = match operation {
        QuestionOperation::Multiply => (1..=12).contains(&left) && (1..=12).contains(&right),
        QuestionOperation::Divide => {
            (1..=144).contains(&left)
                && (1..=12).contains(&right)
                && left % right == 0
                && (1..=12).contains(&(left / right))
        }
    };
    if attempt.selected < 0 {
        return Some("invalid_answer");
    }
    if !valid_operands || !valid_learning_day_key(attempt) {
        return Some("inconsistent_attempt");
    }
    let correct = correct_answer(&PracticeQuestion {
        answer_mode: attempt.answer_mode,
        choices: Vec::new(),
        exercise: None,
        fact_key: attempt.fact_key.clone(),
        id: String::new(),
        left,
        operation,
        right,
    });
    let consistent = attempt.fact_key == fact_key(left, operation, right)
        && attempt.correct == (attempt.selected == correct)
        && match attempt.answer_mode {
            AnswerMode::Choice => {
                attempt.choices.contains(&attempt.selected) && attempt.choices.contains(&correct)
            }
            AnswerMode::Keypad => attempt.choices.is_empty(),
        }
        && attempt.sequence < attempt.question_count;
    (!consistent).then_some("inconsistent_attempt")
}

/// Validates a batch and stores the consistent events.
pub async fn ingest(
    store: &Store,
    profile_id: &str,
    attempts: Vec<AttemptEvent>,
    now: Millis,
) -> lt_store::Result<SyncResult> {
    let mut seen: Vec<String> = Vec::new();
    let mut rejected = Vec::new();
    let mut valid = Vec::new();
    for attempt in attempts {
        let reason = if seen.contains(&attempt.event_id) {
            Some("duplicate_in_batch")
        } else {
            rejection_reason(&attempt)
        };
        match reason {
            Some(reason) => rejected.push(Rejection {
                event_id: attempt.event_id,
                reason,
            }),
            None => {
                seen.push(attempt.event_id.clone());
                valid.push(attempt);
            }
        }
    }
    let stored = store.insert_attempts(profile_id, &valid, now).await?;
    rejected.extend(
        stored
            .duplicate_sequences
            .into_iter()
            .map(|event_id| Rejection {
                event_id,
                reason: "duplicate_sequence",
            }),
    );
    Ok(SyncResult {
        accepted: stored.accepted,
        duplicates: stored.duplicates,
        rejected,
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn wire(overrides: Value) -> Value {
        let mut attempt = json!({
            "answerMode": "choice", "answeredAt": 1_767_634_200_000_i64, "choices": [12, 7, 9, 14],
            "correct": true, "eventId": "e1", "factKey": "3:4", "latencyMs": 2100, "left": 3,
            "questionCount": 10, "right": 4, "selected": 12, "sequence": 0, "sessionId": "s1",
        });
        for (key, value) in overrides.as_object().unwrap() {
            attempt[key] = value.clone();
        }
        attempt
    }

    fn decode(overrides: Value) -> Result<AttemptEvent, String> {
        decode_attempt(wire(overrides))
    }

    #[test]
    fn decodes_the_wire_format() {
        let attempt = decode(json!({})).unwrap();
        assert_eq!(attempt.answered_at, 1_767_634_200_000);
        assert_eq!(attempt.operation, Some(QuestionOperation::Multiply));
        assert_eq!(rejection_reason(&attempt), None);
        assert!(decode(json!({"answeredAt": "2026-01-05T17:30:00.000Z"})).is_err());
        assert!(decode(json!({"answeredAt": 0})).is_err());
        assert!(decode(json!({"latencyMs": 1.5})).is_err());
        assert!(decode(json!({"questionCount": 0})).is_err());
        assert!(decode(json!({"learningDayKey": "2026-1-5"})).is_err());
        assert!(decode(json!({"left": 0})).is_err());
        assert!(decode(json!({"eventId": ""})).is_err());
    }

    #[test]
    fn keeps_the_version_of_known_composition_rules() {
        let version = |value: Value| {
            decode(json!({ "algorithmVersion": value }))
                .unwrap()
                .algorithm_version
        };
        assert_eq!(version(json!("2")).as_deref(), Some("2"));
        assert_eq!(version(json!("1")).as_deref(), Some("1"));
        assert_eq!(version(json!("9")), None);
        assert_eq!(decode(json!({})).unwrap().algorithm_version, None);
    }

    #[test]
    fn applies_the_fact_rules() {
        let reason = |overrides| rejection_reason(&decode(overrides).unwrap());
        assert_eq!(
            reason(json!({"factKey": "4:3"})),
            Some("inconsistent_attempt")
        );
        assert_eq!(
            reason(json!({"correct": false})),
            Some("inconsistent_attempt")
        );
        assert_eq!(
            reason(json!({"choices": [7, 9, 14, 15]})),
            Some("inconsistent_attempt")
        );
        assert_eq!(
            reason(json!({"answerMode": "keypad"})),
            Some("inconsistent_attempt")
        );
        assert_eq!(
            reason(json!({"answerMode": "keypad", "choices": []})),
            None,
            "keypad answers have no choices"
        );
        assert_eq!(
            reason(json!({"sequence": 10})),
            Some("inconsistent_attempt")
        );
        assert_eq!(
            reason(json!({"learningDayKey": "2026-02-30"})),
            Some("inconsistent_attempt")
        );
        assert_eq!(reason(json!({"left": 13})), Some("inconsistent_attempt"));
        assert_eq!(
            reason(
                json!({"operation": "divide", "left": 12, "right": 4, "factKey": "divide:12:4", "selected": 3, "choices": [3, 4]})
            ),
            None
        );
        assert_eq!(
            reason(
                json!({"operation": "divide", "left": 13, "right": 4, "factKey": "divide:13:4"})
            ),
            Some("inconsistent_attempt")
        );
    }

    #[test]
    fn reads_bare_dates_like_javascript() {
        assert_eq!(parse_instant("2026-01-05"), Some(1_767_571_200_000));
        assert_eq!(
            parse_instant("2026-01-05T18:30:00+01:00"),
            Some(1_767_634_200_000)
        );
    }
}

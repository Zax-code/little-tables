//! What a parent sees in "What's hard" (`docs/rewrite/TECHNICAL_SPEC.md` §5.6): the facts and
//! skills to work on again, how regularly the child practised, the time spent and what grew over
//! the period. Never a score, never a comparison between children.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use crate::day_key::shift_day_key;
use crate::engine::{derive_learning_progress, latency_limit_ms};
use crate::exercises::skill_for_key;
use crate::model::{
    AttemptEvent, CurriculumPolicy, LearningPathSettings, LearningSnapshot, MasteryState,
    PracticeAnswer, SkillId,
};

/// A fact needs work again from this error rate, over at least `MIN_ANSWERS` answers.
const ERROR_RATE: f64 = 0.4;
const MIN_ANSWERS: usize = 3;
/// A fact is slow when the median of at least this many right answers is over its time limit.
const MIN_TIMED_ANSWERS: usize = 2;
/// Each answer counts for at most this long in the time spent.
const ANSWER_CAP_MS: f64 = 30_000.0;
/// A week blooms from this many practice days.
const BLOOMING_WEEK_DAYS: usize = 3;
/// The longest list of things to work on.
const MAX_STRUGGLES: usize = 8;

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum StruggleReason {
    /// Answered wrong often.
    Mistakes,
    /// Known before, forgotten during the period.
    Lapses,
    /// Right, but slowly.
    Slow,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Struggle {
    pub answers: i64,
    /// The wrong answer given most often, if any.
    pub common_wrong_answer: Option<PracticeAnswer>,
    pub fact_key: String,
    pub lapses: i64,
    pub median_latency_ms: Option<f64>,
    pub mistakes: i64,
    pub reasons: Vec<StruggleReason>,
    /// The skill of a generated exercise; `None` for multiplication and division facts.
    pub skill: Option<SkillId>,
    /// For a verb: the persons answered wrong, most often first (0 je … 5 ils).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub persons: Vec<PersonMistakes>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PersonMistakes {
    pub mistakes: i64,
    pub person: i64,
}

/// The persons of the conjugation questions answered wrong, most often first.
fn person_mistakes(answers: &[&AttemptEvent]) -> Vec<PersonMistakes> {
    let mut counts: Vec<PersonMistakes> = Vec::new();
    for attempt in answers.iter().filter(|attempt| !attempt.correct) {
        let Some(crate::model::Exercise::Conjugation(exercise)) = &attempt.exercise else {
            continue;
        };
        match counts
            .iter_mut()
            .find(|count| count.person == exercise.person)
        {
            Some(count) => count.mistakes += 1,
            None => counts.push(PersonMistakes {
                mistakes: 1,
                person: exercise.person,
            }),
        }
    }
    counts.sort_by(|left, right| {
        right
            .mistakes
            .cmp(&left.mistakes)
            .then(left.person.cmp(&right.person))
    });
    counts
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Regularity {
    pub blooming_weeks: i64,
    pub practiced_days: i64,
    pub range_days: i64,
    pub weeks: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Growth {
    pub became_familiar: Vec<String>,
    pub became_fluent: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WellOnTheWay {
    pub skills: Vec<SkillId>,
    pub tables: Vec<i64>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Insights {
    pub answers: i64,
    pub correct_answers: i64,
    pub from_day_key: String,
    pub growth: Growth,
    pub regularity: Regularity,
    pub struggles: Vec<Struggle>,
    pub time_spent_ms: i64,
    pub to_day_key: String,
    pub well_on_the_way: WellOnTheWay,
}

pub struct InsightsInput<'a> {
    /// The events of the period, in the order they were answered.
    pub attempts: &'a [AttemptEvent],
    /// The learning state before the period, and now.
    pub before: &'a LearningSnapshot,
    pub after: &'a LearningSnapshot,
    pub learning_paths: &'a LearningPathSettings,
    /// The learning day of each event (`AttemptEvent::learning_day_key`, or a fallback).
    pub day_key_of: &'a dyn Fn(&AttemptEvent) -> String,
    pub range_days: i64,
    pub today_key: &'a str,
}

/// The first day of a period of `range_days` ending today.
pub fn period_start(today_key: &str, range_days: i64) -> String {
    shift_day_key(today_key, 1 - range_days.max(1))
}

fn median(values: &mut [f64]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    values.sort_by(f64::total_cmp);
    let middle = values.len() / 2;
    Some(if values.len().is_multiple_of(2) {
        (values[middle - 1] + values[middle]) / 2.0
    } else {
        values[middle]
    })
}

/// What a wrong answer was: the exercise's response, or the number picked or typed.
fn given_answer(attempt: &AttemptEvent) -> PracticeAnswer {
    attempt.response.clone().unwrap_or(PracticeAnswer::Integer {
        value: attempt.selected,
    })
}

fn most_frequent(answers: &[PracticeAnswer]) -> Option<PracticeAnswer> {
    let mut counts: Vec<(&PracticeAnswer, usize)> = Vec::new();
    for answer in answers {
        match counts.iter_mut().find(|(seen, _)| *seen == answer) {
            Some((_, count)) => *count += 1,
            None => counts.push((answer, 1)),
        }
    }
    // The first one given wins a tie.
    let mut best: Option<(&PracticeAnswer, usize)> = None;
    for (answer, count) in counts {
        if best.is_none_or(|(_, top)| count > top) {
            best = Some((answer, count));
        }
    }
    best.map(|(answer, _)| answer.clone())
}

fn state_in(snapshot: &LearningSnapshot, key: &str) -> MasteryState {
    snapshot
        .facts
        .get(key)
        .map_or(MasteryState::Unseen, |fact| fact.state)
}

pub fn derive_insights(input: &InsightsInput<'_>) -> Insights {
    let range_days = input.range_days.max(1);
    let from_day_key = period_start(input.today_key, range_days);
    let attempts: Vec<&AttemptEvent> = input
        .attempts
        .iter()
        .filter(|attempt| {
            let day = (input.day_key_of)(attempt);
            day >= from_day_key && day.as_str() <= input.today_key
        })
        .collect();

    let mut by_fact: IndexMap<&str, Vec<&AttemptEvent>> = IndexMap::new();
    for attempt in &attempts {
        by_fact.entry(&attempt.fact_key).or_default().push(attempt);
    }
    let mut struggles: Vec<Struggle> = by_fact
        .iter()
        .filter_map(|(key, answers)| {
            let wrong: Vec<PracticeAnswer> = answers
                .iter()
                .filter(|attempt| !attempt.correct)
                .map(|attempt| given_answer(attempt))
                .collect();
            let mistakes = wrong.len();
            let lapses = input
                .after
                .facts
                .get(*key)
                .map_or(0, |fact| fact.lapse_count)
                - input
                    .before
                    .facts
                    .get(*key)
                    .map_or(0, |fact| fact.lapse_count);
            let mut latencies: Vec<f64> = answers
                .iter()
                .filter(|attempt| attempt.correct)
                .map(|attempt| attempt.latency_ms)
                .collect();
            let timed = latencies.len();
            let median_latency_ms = median(&mut latencies);
            let mut reasons = Vec::new();
            if answers.len() >= MIN_ANSWERS && mistakes as f64 / answers.len() as f64 >= ERROR_RATE
            {
                reasons.push(StruggleReason::Mistakes);
            }
            if lapses > 0 {
                reasons.push(StruggleReason::Lapses);
            }
            let slow = timed >= MIN_TIMED_ANSWERS
                && matches!(
                    (latency_limit_ms(key), median_latency_ms),
                    (Some(limit), Some(latency)) if latency > limit
                );
            if slow {
                reasons.push(StruggleReason::Slow);
            }
            (!reasons.is_empty()).then(|| Struggle {
                answers: answers.len() as i64,
                common_wrong_answer: most_frequent(&wrong),
                fact_key: (*key).to_owned(),
                lapses,
                median_latency_ms,
                mistakes: mistakes as i64,
                reasons,
                skill: skill_for_key(key),
                persons: person_mistakes(answers),
            })
        })
        .collect();
    // Mistakes first, then forgetting, then slowness; the most answered first within each.
    struggles.sort_by(|left, right| {
        let rank = |struggle: &Struggle| struggle.reasons.first().copied();
        rank(left)
            .cmp(&rank(right))
            .then(right.mistakes.cmp(&left.mistakes))
            .then(right.lapses.cmp(&left.lapses))
            .then(right.answers.cmp(&left.answers))
    });
    struggles.truncate(MAX_STRUGGLES);

    let mut practiced: Vec<String> = attempts
        .iter()
        .map(|attempt| (input.day_key_of)(attempt))
        .collect();
    practiced.sort();
    practiced.dedup();
    let weeks = range_days / 7;
    let blooming_weeks = (0..weeks)
        .filter(|week| {
            let last = shift_day_key(input.today_key, -7 * week);
            let first = shift_day_key(&last, -6);
            practiced
                .iter()
                .filter(|day| **day >= first && **day <= last)
                .count()
                >= BLOOMING_WEEK_DAYS
        })
        .count() as i64;

    let mut became_familiar = Vec::new();
    let mut became_fluent = Vec::new();
    for key in input.after.facts.keys() {
        let before = state_in(input.before, key);
        match state_in(input.after, key) {
            MasteryState::Fluent if before != MasteryState::Fluent => {
                became_fluent.push(key.clone());
            }
            MasteryState::Familiar if !before.is_stable() => became_familiar.push(key.clone()),
            _ => {}
        }
    }

    let curriculum = CurriculumPolicy {
        packs: None,
        paths: Some(input.learning_paths.clone()),
    };
    let progress = derive_learning_progress(input.after, Some(&curriculum));
    let rooted = |familiar: i64, fluent: i64, total: i64| total > 0 && familiar + fluent == total;

    Insights {
        answers: attempts.len() as i64,
        correct_answers: attempts.iter().filter(|attempt| attempt.correct).count() as i64,
        from_day_key,
        growth: Growth {
            became_familiar,
            became_fluent,
        },
        regularity: Regularity {
            blooming_weeks,
            practiced_days: practiced.len() as i64,
            range_days,
            weeks,
        },
        struggles,
        time_spent_ms: attempts
            .iter()
            .map(|attempt| attempt.latency_ms.clamp(0.0, ANSWER_CAP_MS))
            .sum::<f64>()
            .round() as i64,
        to_day_key: input.today_key.to_owned(),
        well_on_the_way: WellOnTheWay {
            skills: progress
                .paths
                .iter()
                .flat_map(|path| &path.skills)
                .filter(|skill| skill.open && rooted(skill.familiar, skill.fluent, skill.total))
                .map(|skill| skill.id)
                .collect(),
            tables: progress
                .tables
                .iter()
                .filter(|table| rooted(table.facts.familiar, table.facts.fluent, table.facts.total))
                .map(|table| table.table)
                .collect(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{AnswerMode, FactMastery, Facts};

    fn attempt(
        id: &str,
        key: &str,
        day: &str,
        correct: bool,
        selected: i64,
        latency: f64,
    ) -> AttemptEvent {
        let (left, right) = key
            .split_once(':')
            .map(|(left, right)| (left.parse().unwrap_or(0), right.parse().unwrap_or(0)))
            .unwrap_or((0, 0));
        AttemptEvent {
            algorithm_version: None,
            answer_mode: AnswerMode::Keypad,
            answered_at: 0,
            choices: Vec::new(),
            correct,
            event_id: id.to_owned(),
            exercise: None,
            fact_key: key.to_owned(),
            latency_ms: latency,
            learning_day_key: Some(day.to_owned()),
            left,
            operation: None,
            response: None,
            right,
            question_count: 10,
            selected,
            sequence: 0,
            session_id: "s".to_owned(),
            session_kind: None,
        }
    }

    fn snapshot(facts: &[(&str, MasteryState, i64)]) -> LearningSnapshot {
        let mut map = Facts::new();
        for (key, state, lapses) in facts {
            map.insert(
                (*key).to_owned(),
                FactMastery {
                    lapse_count: *lapses,
                    state: *state,
                    ..FactMastery::empty()
                },
            );
        }
        LearningSnapshot {
            facts: map,
            ..LearningSnapshot::default()
        }
    }

    fn day_key_of(attempt: &AttemptEvent) -> String {
        attempt.learning_day_key.clone().unwrap_or_default()
    }

    #[test]
    fn finds_what_to_work_on_and_what_grew() {
        let attempts = vec![
            // 7×8: three wrong out of four, mostly 54.
            attempt("a", "7:8", "2026-10-01", false, 54, 2000.0),
            attempt("b", "7:8", "2026-10-02", false, 54, 2500.0),
            attempt("c", "7:8", "2026-10-03", false, 48, 2500.0),
            attempt("d", "7:8", "2026-10-04", true, 56, 2000.0),
            // 6×9: right, but slowly.
            attempt("e", "6:9", "2026-10-04", true, 54, 5000.0),
            attempt("f", "6:9", "2026-10-05", true, 54, 7000.0),
            // 2×3: easy, and an answer too long to count fully.
            attempt("g", "2:3", "2026-10-05", true, 6, 90_000.0),
            // Before the period: ignored.
            attempt("h", "2:3", "2026-09-20", false, 5, 1000.0),
        ];
        let before = snapshot(&[
            ("7:8", MasteryState::Familiar, 0),
            ("2:3", MasteryState::Learning, 0),
            ("2:2", MasteryState::Familiar, 0),
        ]);
        let after = snapshot(&[
            ("7:8", MasteryState::Learning, 1),
            ("2:3", MasteryState::Fluent, 0),
            ("2:2", MasteryState::Familiar, 0),
            ("6:9", MasteryState::Familiar, 0),
        ]);
        let insights = derive_insights(&InsightsInput {
            after: &after,
            attempts: &attempts,
            before: &before,
            day_key_of: &day_key_of,
            learning_paths: &LearningPathSettings::default(),
            range_days: 7,
            today_key: "2026-10-05",
        });

        assert_eq!(insights.from_day_key, "2026-09-29");
        assert_eq!((insights.answers, insights.correct_answers), (7, 4));
        assert_eq!(
            insights.time_spent_ms,
            2000 + 2500 + 2500 + 2000 + 5000 + 7000 + 30_000
        );
        assert_eq!(insights.struggles.len(), 2);
        let multiplication = &insights.struggles[0];
        assert_eq!(multiplication.fact_key, "7:8");
        assert_eq!(
            multiplication.reasons,
            vec![StruggleReason::Mistakes, StruggleReason::Lapses]
        );
        assert_eq!((multiplication.mistakes, multiplication.lapses), (3, 1));
        assert_eq!(
            multiplication.common_wrong_answer,
            Some(PracticeAnswer::Integer { value: 54 })
        );
        assert_eq!(multiplication.skill, None);
        let slow = &insights.struggles[1];
        assert_eq!(slow.fact_key, "6:9");
        assert_eq!(slow.reasons, vec![StruggleReason::Slow]);
        assert_eq!(slow.median_latency_ms, Some(6000.0));
        assert_eq!(slow.common_wrong_answer, None);

        assert_eq!(
            insights.regularity,
            Regularity {
                blooming_weeks: 1,
                practiced_days: 5,
                range_days: 7,
                weeks: 1,
            }
        );
        assert_eq!(insights.growth.became_fluent, vec!["2:3".to_owned()]);
        assert_eq!(insights.growth.became_familiar, vec!["6:9".to_owned()]);
    }

    #[test]
    fn a_quiet_period_has_nothing_to_say() {
        let empty = LearningSnapshot::default();
        let insights = derive_insights(&InsightsInput {
            after: &empty,
            attempts: &[],
            before: &empty,
            day_key_of: &day_key_of,
            learning_paths: &LearningPathSettings::default(),
            range_days: 30,
            today_key: "2026-10-05",
        });
        assert_eq!(insights.from_day_key, "2026-09-06");
        assert!(insights.struggles.is_empty());
        assert_eq!(insights.regularity.weeks, 4);
        assert_eq!(insights.regularity.blooming_weeks, 0);
        assert_eq!(insights.time_spent_ms, 0);
        assert!(insights.well_on_the_way.tables.is_empty());
    }
}

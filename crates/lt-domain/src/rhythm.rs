//! The week in bloom and the comeback greeting.

use serde::{Deserialize, Serialize};

use crate::day_key::{days_between, shift_day_key};
use crate::model::SessionKind;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ComebackKind {
    Long,
    None,
    Short,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekDay {
    pub day_key: String,
    pub practiced: bool,
    pub today: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeRhythm {
    pub comeback: ComebackKind,
    pub daily_watering_done: bool,
    pub petal_count: i64,
    pub total_rewarded_days: i64,
    pub visits_until_blooming_week: i64,
    pub week: Vec<WeekDay>,
    pub weekly_practice_days: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveSessionProgress {
    pub current_index: i64,
    pub kind: SessionKind,
    pub question_count: i64,
}

pub fn derive_practice_rhythm(
    active_session: Option<&ActiveSessionProgress>,
    practice_day_keys: &[String],
    rewarded_day_keys: &[String],
    today_key: &str,
) -> PracticeRhythm {
    let week: Vec<WeekDay> = (0..7)
        .map(|index| {
            let day_key = shift_day_key(today_key, index - 6);
            WeekDay {
                practiced: practice_day_keys.contains(&day_key),
                today: day_key == today_key,
                day_key,
            }
        })
        .collect();
    let weekly_practice_days = week.iter().filter(|day| day.practiced).count() as i64;
    let latest_practice_day = practice_day_keys
        .iter()
        .filter(|day_key| day_key.as_str() <= today_key)
        .max();
    let days_away = latest_practice_day.map_or(0, |latest| days_between(latest, today_key));
    let comeback = if days_away >= 7 {
        ComebackKind::Long
    } else if days_away >= 2 {
        ComebackKind::Short
    } else {
        ComebackKind::None
    };
    let daily_watering_done = rewarded_day_keys.iter().any(|day_key| day_key == today_key);
    let partial_petals = match active_session {
        Some(session)
            if session.kind == SessionKind::DailyWatering && session.question_count > 0 =>
        {
            ((session.current_index as f64 / session.question_count as f64) * 5.0)
                .ceil()
                .min(4.0) as i64
        }
        _ => 0,
    };
    let mut distinct_rewarded: Vec<&String> = Vec::new();
    for day_key in rewarded_day_keys {
        if !distinct_rewarded.contains(&day_key) {
            distinct_rewarded.push(day_key);
        }
    }

    PracticeRhythm {
        comeback,
        daily_watering_done,
        petal_count: if daily_watering_done {
            5
        } else {
            partial_petals
        },
        total_rewarded_days: distinct_rewarded.len() as i64,
        visits_until_blooming_week: (3 - weekly_practice_days).max(0),
        week,
        weekly_practice_days,
    }
}

//! Learning days. A learning day is the calendar date in the learner's time zone, written
//! `YYYY-MM-DD`. The engine never reads a clock or a time zone database itself: callers provide a
//! [`DayKeys`] implementation. The server uses [`IanaDayKeys`]; the browser answers from `Intl`.

use chrono::{Duration, NaiveDate};

use crate::model::Millis;

pub trait DayKeys {
    /// The calendar date of `at` in `time_zone`.
    fn day_key(&self, at: Millis, time_zone: &str) -> String;
}

impl<F: Fn(Millis, &str) -> String> DayKeys for F {
    fn day_key(&self, at: Millis, time_zone: &str) -> String {
        self(at, time_zone)
    }
}

/// Day keys from the IANA database. Unknown zones fall back to UTC.
#[cfg(feature = "tz")]
#[derive(Clone, Copy, Debug, Default)]
pub struct IanaDayKeys;

#[cfg(feature = "tz")]
impl DayKeys for IanaDayKeys {
    fn day_key(&self, at: Millis, time_zone: &str) -> String {
        let instant = chrono::DateTime::from_timestamp_millis(at).unwrap_or_default();
        match time_zone.parse::<chrono_tz::Tz>() {
            Ok(zone) => instant.with_timezone(&zone).format("%Y-%m-%d").to_string(),
            Err(_) => instant.format("%Y-%m-%d").to_string(),
        }
    }
}

/// Day keys in UTC, for callers that have no zone.
#[derive(Clone, Copy, Debug, Default)]
pub struct UtcDayKeys;

impl DayKeys for UtcDayKeys {
    fn day_key(&self, at: Millis, _time_zone: &str) -> String {
        chrono::DateTime::from_timestamp_millis(at)
            .unwrap_or_default()
            .format("%Y-%m-%d")
            .to_string()
    }
}

pub(crate) fn parse_day_key(day_key: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(day_key, "%Y-%m-%d").ok()
}

/// The day key `days` days after `day_key`.
pub fn shift_day_key(day_key: &str, days: i64) -> String {
    parse_day_key(day_key)
        .map(|date| (date + Duration::days(days)).format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

/// Whole days from `earlier` to `later`, never negative.
pub fn days_between(earlier: &str, later: &str) -> i64 {
    match (parse_day_key(earlier), parse_day_key(later)) {
        (Some(earlier), Some(later)) => (later - earlier).num_days().max(0),
        _ => 0,
    }
}

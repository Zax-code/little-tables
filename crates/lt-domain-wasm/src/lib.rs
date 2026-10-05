//! WebAssembly entry point of the learning engine.
//!
//! The browser calls [`run`] with an operation name and a JSON input, and passes a function that
//! returns the `YYYY-MM-DD` learning day of an instant in a time zone (computed with `Intl`), so
//! the module carries no time zone database.

use js_sys::Function;
use lt_domain::api::dispatch;
use lt_domain::day_key::DayKeys;
use lt_domain::model::Millis;
use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

struct BrowserDayKeys<'a>(&'a Function);

impl DayKeys for BrowserDayKeys<'_> {
    fn day_key(&self, at: Millis, time_zone: &str) -> String {
        self.0
            .call2(
                &JsValue::NULL,
                &JsValue::from_f64(at as f64),
                &JsValue::from_str(time_zone),
            )
            .ok()
            .and_then(|value| value.as_string())
            .unwrap_or_default()
    }
}

/// Runs one engine operation. Returns `{"ok": value}` or `{"error": message}` as JSON.
#[wasm_bindgen]
pub fn run(operation: &str, input: &str, day_key: &Function) -> String {
    let result = serde_json::from_str::<Value>(input)
        .map_err(|error| format!("input is not JSON: {error}"))
        .and_then(|input| dispatch(operation, input, &BrowserDayKeys(day_key)));
    match result {
        Ok(value) => json!({ "ok": value }),
        Err(message) => json!({ "error": message }),
    }
    .to_string()
}

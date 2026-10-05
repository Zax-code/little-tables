//! Responses, names and the caller's family, shared by the API handlers.

use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use lt_auth::{SESSION_COOKIE, SESSION_LIFETIME_MS, SessionClaims};
use lt_store::Family;
use serde_json::{Value, json};

use crate::state::{AppState, now};

pub(crate) const SELECTABLE_AVATARS: [&str; 6] = [
    "sprout",
    "malo-bear",
    "fenna-fox",
    "mina-cat",
    "paco-dog",
    "colin-mallard",
];
pub(crate) const DEFAULT_AVATAR: &str = "sprout";

pub fn json_response(status: StatusCode, body: Value) -> Response {
    (status, axum::Json(body)).into_response()
}

pub fn ok(body: Value) -> Response {
    json_response(StatusCode::OK, body)
}

pub fn error(status: StatusCode, code: &str) -> Response {
    json_response(status, json!({ "error": code }))
}

/// A trimmed, non-empty name of at most 40 characters.
pub fn is_valid_name(name: &str) -> bool {
    !name.is_empty() && name.trim() == name && name.chars().count() <= 40
}

pub(crate) fn truncated_name(name: &str) -> String {
    name.chars().take(40).collect()
}

pub(crate) fn with_session(mut response: Response, session: &str) -> Response {
    let cookie = format!(
        "{SESSION_COOKIE}={session}; Max-Age={}; Path=/; HttpOnly; Secure; SameSite=Lax",
        SESSION_LIFETIME_MS / 1000
    );
    if let Ok(value) = HeaderValue::from_str(&cookie) {
        response.headers_mut().append(header::SET_COOKIE, value);
    }
    response
}

/// The caller's family, created on first use with one child named after the Google account.
pub(crate) async fn family_for_identity(
    state: &AppState,
    headers: &HeaderMap,
) -> lt_store::Result<Option<(Family, SessionClaims)>> {
    let Some(identity) = state.identity(headers).await else {
        return Ok(None);
    };
    if let Some(family) = state.store.find_family(&identity.google_subject).await? {
        return Ok(Some((family, identity)));
    }
    let fallback_name = truncated_name(&identity.display_name);
    if !is_valid_name(&fallback_name) {
        return Ok(None);
    }
    let family = state
        .store
        .ensure_family(
            &identity.google_subject,
            &fallback_name,
            None,
            DEFAULT_AVATAR,
            now(),
        )
        .await?;
    Ok(Some((family, identity)))
}

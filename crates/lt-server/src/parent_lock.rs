//! The parent code of `/api/v2` (`docs/rewrite/TECHNICAL_SPEC.md` §6.4): four digits hashed with
//! Argon2id, five wrong attempts lock it for fifteen minutes, and a fresh Google sign-in resets it.
//!
//! Devices keep their own PBKDF2 hash of the code for offline checks; the salt they use comes from
//! here and changes with the code, which tells them their copy is out of date.

use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use lt_auth::pin::{LOCK_MS, MAX_FAILURES, device_salt, hash_pin, is_valid_pin, verify_pin};
use lt_store::ParentLock;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::http::{json_response, ok};
use crate::state::{AppState, now};
use crate::v2::{Failure, Reply, body, fail, family};

/// PBKDF2 settings for the device's offline copy of the code.
const DEVICE_HASH: &str = "SHA-256";
const DEVICE_ITERATIONS: u32 = 100_000;
/// How recent the Google sign-in that resets the code must be.
const FRESH_SIGN_IN_MS: i64 = 10 * 60 * 1000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewCode {
    #[serde(default)]
    current_pin: Option<String>,
    pin: String,
}

#[derive(Deserialize)]
struct Code {
    pin: String,
}

#[derive(Deserialize)]
struct Reset {
    #[serde(default)]
    credential: Option<String>,
}

fn status_json(lock: Option<&ParentLock>, at: i64) -> Value {
    json!({
        "configured": lock.is_some(),
        "lockedUntil": lock.and_then(|lock| lock.locked_until.filter(|until| *until > at)),
        "pinSalt": lock.map(|lock| lock.pin_salt.as_str()),
    })
}

/// What a device needs to check the code offline.
fn device_json(pin_salt: &str) -> Value {
    json!({
        "pinHashParams": { "hash": DEVICE_HASH, "iterations": DEVICE_ITERATIONS },
        "pinSalt": pin_salt,
    })
}

fn locked(until: i64) -> Failure {
    Failure::from(json_response(
        StatusCode::LOCKED,
        json!({ "error": "parent_lock_locked", "lockedUntil": until }),
    ))
}

/// Argon2 is deliberately slow; it runs away from the request threads.
async fn matches(pin: String, hash: String) -> bool {
    tokio::task::spawn_blocking(move || verify_pin(&pin, &hash))
        .await
        .unwrap_or(false)
}

/// Checks `pin` against the family's code, counting a wrong one.
async fn check(
    state: &AppState,
    subject: &str,
    lock: &ParentLock,
    pin: &str,
) -> Result<(), Failure> {
    let at = now();
    if let Some(until) = lock.locked_until.filter(|until| *until > at) {
        return Err(locked(until));
    }
    if is_valid_pin(pin) && matches(pin.to_owned(), lock.pin_hash.clone()).await {
        state.store.clear_parent_lock_failures(subject, at).await?;
        return Ok(());
    }
    let after = state
        .store
        .record_parent_lock_failure(subject, MAX_FAILURES, LOCK_MS, at)
        .await?;
    match after {
        Some(ParentLock {
            locked_until: Some(until),
            ..
        }) if until > at => Err(locked(until)),
        Some(after) => Err(Failure::from(json_response(
            StatusCode::FORBIDDEN,
            json!({
                "error": "wrong_pin",
                "remainingAttempts": MAX_FAILURES - after.failed_attempts,
            }),
        ))),
        None => Err(fail(StatusCode::NOT_FOUND, "parent_lock_not_set")),
    }
}

pub async fn status(State(state): State<AppState>, headers: HeaderMap) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    let lock = state.store.parent_lock(&family.google_subject).await?;
    Ok(ok(status_json(lock.as_ref(), now())))
}

/// Sets the code, or changes it with the current one.
pub async fn set(State(state): State<AppState>, headers: HeaderMap, bytes: Bytes) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    let subject = &family.google_subject;
    let input: NewCode = body(&bytes, "invalid_pin")?;
    if !is_valid_pin(&input.pin) {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_pin"));
    }
    if let Some(lock) = state.store.parent_lock(subject).await? {
        let current = input.current_pin.as_deref().unwrap_or_default();
        check(&state, subject, &lock, current).await?;
    }
    let pin = input.pin;
    let pin_hash = tokio::task::spawn_blocking(move || hash_pin(&pin))
        .await
        .map_err(|_| fail(StatusCode::SERVICE_UNAVAILABLE, "unavailable"))?;
    let pin_salt = device_salt();
    state
        .store
        .set_parent_lock(subject, &pin_hash, &pin_salt, now())
        .await?;
    Ok(ok(device_json(&pin_salt)))
}

pub async fn verify(State(state): State<AppState>, headers: HeaderMap, bytes: Bytes) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    let subject = &family.google_subject;
    let input: Code = body(&bytes, "invalid_pin")?;
    let lock = state
        .store
        .parent_lock(subject)
        .await?
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "parent_lock_not_set"))?;
    check(&state, subject, &lock, &input.pin).await?;
    Ok(ok(device_json(&lock.pin_salt)))
}

/// Forgets the code after the parent signs in with Google again, on this device, just now.
pub async fn reset(State(state): State<AppState>, headers: HeaderMap, bytes: Bytes) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    // Without Google sign-in (development), the session alone is enough.
    if state.config.auth.is_some() {
        let input: Reset = body(&bytes, "invalid_google_credential")?;
        let invalid = || fail(StatusCode::FORBIDDEN, "invalid_google_credential");
        let credential = input.credential.filter(|credential| !credential.is_empty());
        let identity = match credential {
            Some(credential) => match state.verifier.verify(&credential).await {
                Ok(Some(identity)) => identity,
                _ => return Err(invalid()),
            },
            None => return Err(invalid()),
        };
        let fresh = identity
            .issued_at
            .is_some_and(|issued| now() - issued <= FRESH_SIGN_IN_MS);
        if identity.subject != family.google_subject || !fresh {
            return Err(invalid());
        }
    }
    state
        .store
        .remove_parent_lock(&family.google_subject)
        .await?;
    Ok(ok(status_json(None, now())))
}

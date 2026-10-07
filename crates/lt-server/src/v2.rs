//! The `/api/v2` contract of the new web app (`docs/rewrite/TECHNICAL_SPEC.md` §5.3).
//!
//! Profiles are named in the path, instants are Unix milliseconds, and every mutating request
//! must carry `X-Little-Tables: 1` and come from the app's own origin.

use std::time::Instant;

use axum::Router;
use axum::body::Bytes;
use axum::extract::{Path, Query, Request, State};
use axum::http::{Extensions, HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, patch, post, put};
use lt_auth::{SESSION_COOKIE, SessionClaims, normalize_email};
use lt_domain::model::{LearningPathSettings, LearningSnapshot};
use lt_store::{ChildProfile, PushSubscription, RemoveChildResult, day_key_of};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer};
use serde_json::{Value, json};

use crate::bootstrap::{collection_json, profile_state};
use crate::http::{
    DEFAULT_AVATAR, SELECTABLE_AVATARS, error, family_for_identity, is_valid_name, json_response,
    ok, truncated_name, with_session,
};
use crate::ingestion::{decode_attempt, ingest};
use crate::limits::client_ip;
use crate::parent_lock;
use crate::state::{AppState, cookie, now};

/// The earliest and latest reminder times, and their step, in minutes after midnight.
const REMINDER_RANGE: std::ops::RangeInclusive<i64> = 7 * 60..=21 * 60;
const REMINDER_STEP: i64 = 15;

/// A refused request, returned as the response it deserves.
pub struct Failure(Box<Response>);

impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        *self.0
    }
}

impl From<Response> for Failure {
    fn from(response: Response) -> Self {
        Self(Box::new(response))
    }
}

impl From<lt_store::StoreError> for Failure {
    fn from(failure: lt_store::StoreError) -> Self {
        tracing::error!(%failure, "storage failed");
        fail(StatusCode::SERVICE_UNAVAILABLE, "unavailable")
    }
}

pub(crate) fn fail(status: StatusCode, code: &str) -> Failure {
    Failure(Box::new(error(status, code)))
}

pub(crate) type Reply = Result<Response, Failure>;

pub(crate) fn body<T: DeserializeOwned>(bytes: &[u8], code: &str) -> Result<T, Failure> {
    serde_json::from_slice(bytes).map_err(|_| fail(StatusCode::BAD_REQUEST, code))
}

/// A profile as the new app reads it.
pub fn profile_json(profile: &ChildProfile) -> Value {
    json!({
        "avatarId": profile.avatar_id,
        "id": profile.id,
        "learningPaths": profile.learning_paths.clone().unwrap_or_default(),
        "name": profile.name,
        "reminderMinute": profile.reminder_minute,
    })
}

async fn caller(state: &AppState, headers: &HeaderMap) -> Result<SessionClaims, Failure> {
    state
        .identity(headers)
        .await
        .ok_or_else(|| fail(StatusCode::UNAUTHORIZED, "unauthorized"))
}

/// The caller, when the profile in the path belongs to their family.
async fn owner(
    state: &AppState,
    headers: &HeaderMap,
    profile_id: &str,
) -> Result<SessionClaims, Failure> {
    let identity = caller(state, headers).await?;
    if state.owns_profile(&identity, profile_id).await? {
        Ok(identity)
    } else {
        Err(fail(StatusCode::FORBIDDEN, "profile_forbidden"))
    }
}

/// The origin requests must come from: `PUBLIC_ORIGIN`, or the requested host in development.
fn expected_origins(state: &AppState, headers: &HeaderMap) -> Vec<String> {
    match &state.config.public_origin {
        Some(origin) => vec![origin.clone()],
        None => headers
            .get(header::HOST)
            .and_then(|host| host.to_str().ok())
            .map(|host| vec![format!("http://{host}"), format!("https://{host}")])
            .unwrap_or_default(),
    }
}

/// Refuses mutating requests that a cross-site page could forge.
async fn same_origin_only(State(state): State<AppState>, request: Request, next: Next) -> Response {
    if matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    ) {
        return next.run(request).await;
    }
    let headers = request.headers();
    let marked = headers
        .get("x-little-tables")
        .is_some_and(|value| value == "1");
    let fetch_site = headers
        .get("sec-fetch-site")
        .and_then(|value| value.to_str().ok());
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok());
    let same_site = match (fetch_site, origin) {
        (Some(site), _) => site == "same-origin" || site == "none",
        (None, Some(origin)) => expected_origins(&state, headers)
            .iter()
            .any(|expected| expected == origin),
        (None, None) => false,
    };
    if marked && same_site {
        next.run(request).await
    } else {
        error(StatusCode::FORBIDDEN, "cross_site_request")
    }
}

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/api/v2/auth/status", get(auth_status))
        .route("/api/v2/auth/google", post(google_sign_in))
        .route("/api/v2/auth/logout", post(logout))
        .route("/api/v2/auth/refresh", post(refresh))
        .route("/api/v2/family/onboarding", post(onboarding))
        .route(
            "/api/v2/family/profiles",
            get(list_profiles).post(create_profile),
        )
        .route(
            "/api/v2/family/profiles/{profile_id}",
            patch(update_profile).delete(remove_profile),
        )
        .route(
            "/api/v2/family/profiles/{profile_id}/learning-paths",
            put(update_learning_paths),
        )
        .route(
            "/api/v2/family/parent-lock",
            get(parent_lock::status)
                .put(parent_lock::set)
                .delete(parent_lock::reset),
        )
        .route(
            "/api/v2/family/parent-lock/verify",
            post(parent_lock::verify),
        )
        .route("/api/v2/profiles/{profile_id}/bootstrap", get(bootstrap))
        .route("/api/v2/profiles/{profile_id}/attempts", post(attempts))
        .route("/api/v2/profiles/{profile_id}/insights", get(insights))
        .route(
            "/api/v2/profiles/{profile_id}/garden/introduction-seen",
            post(introduction_seen),
        )
        .route("/api/v2/notifications/config", get(notification_config))
        .route(
            "/api/v2/profiles/{profile_id}/notifications/subscriptions",
            post(subscribe).delete(unsubscribe),
        )
        .route(
            "/api/v2/admin/allowed-emails",
            get(list_emails).post(add_email),
        )
        .route("/api/v2/admin/allowed-emails/{email}", delete(remove_email))
        .route_layer(middleware::from_fn_with_state(state, same_origin_only))
}

/* Authentication ----------------------------------------------------------------------------- */

async fn auth_status(State(state): State<AppState>, headers: HeaderMap) -> Reply {
    let identity = state.identity(&headers).await;
    let auth = state.config.auth.as_ref();
    let onboarding_required = match &identity {
        Some(identity) => state
            .store
            .find_family(&identity.google_subject)
            .await?
            .is_some_and(|family| !family.onboarding_complete),
        None => false,
    };
    Ok(ok(json!({
        "authenticated": identity.is_some(),
        "authenticationRequired": auth.is_some(),
        "email": identity.as_ref().map(|identity| identity.email.clone()),
        "googleClientId": auth.map(|auth| auth.google_client_id.clone()),
        "isAdmin": identity.as_ref().is_some_and(|identity| state.is_admin(&identity.email)),
        "onboardingRequired": onboarding_required,
        "sessionExpiresAt": match (auth, &identity) {
            (Some(_), Some(identity)) => json!(identity.expires_at_ms()),
            _ => Value::Null,
        },
    })))
}

#[derive(Deserialize)]
struct Credential {
    credential: String,
}

async fn google_sign_in(
    State(state): State<AppState>,
    headers: HeaderMap,
    extensions: Extensions,
    bytes: Bytes,
) -> Reply {
    let Some(auth) = state.config.auth.clone() else {
        return Err(fail(StatusCode::NOT_FOUND, "google_auth_unavailable"));
    };
    if !state
        .sign_in_limiter
        .allow(client_ip(&headers, &extensions), Instant::now())
    {
        return Err(fail(StatusCode::TOO_MANY_REQUESTS, "too_many_requests"));
    }
    let invalid = || fail(StatusCode::UNAUTHORIZED, "invalid_google_credential");
    let credential: Credential = body(&bytes, "invalid_google_credential")?;
    let identity = match state.verifier.verify(&credential.credential).await {
        Ok(Some(identity)) if !credential.credential.is_empty() => identity,
        _ => return Err(invalid()),
    };
    if !state.is_allowed(&identity.email).await? {
        return Err(fail(StatusCode::UNAUTHORIZED, "google_account_not_allowed"));
    }
    let fallback_name = truncated_name(&identity.display_name);
    if !is_valid_name(&fallback_name) {
        return Err(invalid());
    }
    let family = state
        .store
        .ensure_family(
            &identity.subject,
            &fallback_name,
            None,
            DEFAULT_AVATAR,
            now(),
        )
        .await?;
    let Some(initial) = family.profiles.first() else {
        return Err(fail(StatusCode::SERVICE_UNAVAILABLE, "unavailable"));
    };
    let claims = SessionClaims::new(
        &initial.name,
        &identity.email,
        &identity.subject,
        &initial.id,
        !family.onboarding_complete,
        state.session_version(&identity.email).await?,
        now(),
    );
    let session = lt_auth::session::issue(&claims, &auth.session_secret);
    Ok(with_session(
        ok(json!({
            "onboardingRequired": !family.onboarding_complete,
            "status": "authenticated",
        })),
        &session,
    ))
}

async fn logout() -> Response {
    let mut response = ok(json!({ "status": "signed-out" }));
    let expired = format!("{SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
    if let Ok(value) = HeaderValue::from_str(&expired) {
        response.headers_mut().append(header::SET_COOKIE, value);
    }
    response
}

async fn refresh(State(state): State<AppState>, headers: HeaderMap) -> Reply {
    let Some(auth) = state.config.auth.clone() else {
        return Ok(ok(json!({ "sessionExpiresAt": null, "status": "renewed" })));
    };
    caller(&state, &headers).await?;
    let renewed = cookie(&headers, SESSION_COOKIE)
        .and_then(|current| lt_auth::session::renew(current, &auth.session_secret, now()))
        .ok_or_else(|| fail(StatusCode::UNAUTHORIZED, "unauthorized"))?;
    let expires_at = lt_auth::session::verify(&renewed, &auth.session_secret, now())
        .map(|claims| claims.expires_at_ms());
    Ok(with_session(
        ok(json!({ "sessionExpiresAt": expires_at, "status": "renewed" })),
        &renewed,
    ))
}

/* Family ------------------------------------------------------------------------------------- */

pub(crate) async fn family(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(lt_store::Family, SessionClaims), Failure> {
    family_for_identity(state, headers)
        .await?
        .ok_or_else(|| fail(StatusCode::UNAUTHORIZED, "unauthorized"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Onboarding {
    #[serde(default)]
    avatar_id: Option<String>,
    name: String,
}

async fn onboarding(State(state): State<AppState>, headers: HeaderMap, bytes: Bytes) -> Reply {
    let (family, identity) = family(&state, &headers).await?;
    if family.onboarding_complete {
        return Err(fail(StatusCode::CONFLICT, "already_onboarded"));
    }
    let input: Onboarding = body(&bytes, "invalid_name")?;
    let name = input.name.trim().to_owned();
    if !is_valid_name(&name) {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_name"));
    }
    if input
        .avatar_id
        .as_deref()
        .is_some_and(|avatar| !SELECTABLE_AVATARS.contains(&avatar))
    {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_avatar"));
    }
    let initial = family
        .profiles
        .iter()
        .find(|profile| profile.id == identity.profile_id)
        .or(family.profiles.first())
        .ok_or_else(|| fail(StatusCode::SERVICE_UNAVAILABLE, "unavailable"))?;
    let subject = &family.google_subject;
    if !state
        .store
        .complete_initial_profile(subject, &initial.id, &name, now())
        .await?
    {
        return Err(fail(StatusCode::CONFLICT, "already_onboarded"));
    }
    let avatar = input.avatar_id.unwrap_or_else(|| initial.avatar_id.clone());
    let profile = state
        .store
        .update_child(subject, &initial.id, &name, &avatar, now())
        .await?
        .ok_or_else(|| fail(StatusCode::SERVICE_UNAVAILABLE, "unavailable"))?;
    let response = json_response(
        StatusCode::CREATED,
        json!({ "profile": profile_json(&profile) }),
    );
    Ok(match &state.config.auth {
        Some(auth) => {
            let claims = SessionClaims {
                display_name: name,
                name_choice_required: false,
                profile_id: profile.id.clone(),
                ..identity
            };
            with_session(
                response,
                &lt_auth::session::issue(&claims, &auth.session_secret),
            )
        }
        None => response,
    })
}

async fn list_profiles(State(state): State<AppState>, headers: HeaderMap) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    let profiles: Vec<Value> = family.profiles.iter().map(profile_json).collect();
    Ok(ok(json!({ "profiles": profiles })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewChild {
    avatar_id: String,
    name: String,
}

async fn create_profile(State(state): State<AppState>, headers: HeaderMap, bytes: Bytes) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    let input: NewChild = body(&bytes, "invalid_child_profile")?;
    let name = input.name.trim();
    if !is_valid_name(name) || !SELECTABLE_AVATARS.contains(&input.avatar_id.as_str()) {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_child_profile"));
    }
    let profile = state
        .store
        .add_child(&family.google_subject, name, &input.avatar_id, now())
        .await?;
    Ok(json_response(
        StatusCode::CREATED,
        json!({ "profile": profile_json(&profile) }),
    ))
}

/// Distinguishes an absent field from an explicit `null`.
fn present<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error> {
    Ok(Some(Option::deserialize(deserializer)?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileChanges {
    #[serde(default)]
    avatar_id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    /// `null` switches the reminder off.
    #[serde(default, deserialize_with = "present")]
    reminder_minute: Option<Option<i64>>,
}

pub fn is_valid_reminder_minute(minute: i64) -> bool {
    REMINDER_RANGE.contains(&minute) && minute % REMINDER_STEP == 0
}

async fn update_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
    bytes: Bytes,
) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    let changes: ProfileChanges = body(&bytes, "invalid_child_profile")?;
    let current = family
        .profiles
        .iter()
        .find(|profile| profile.id == profile_id)
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "profile_not_found"))?;
    let name = changes
        .name
        .as_deref()
        .map(str::trim)
        .unwrap_or(&current.name);
    let avatar = changes.avatar_id.as_deref().unwrap_or(&current.avatar_id);
    let valid = is_valid_name(name)
        && (changes.avatar_id.is_none() || SELECTABLE_AVATARS.contains(&avatar))
        && changes
            .reminder_minute
            .is_none_or(|minute| minute.is_none_or(is_valid_reminder_minute));
    if !valid {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_child_profile"));
    }
    let subject = &family.google_subject;
    let mut profile = state
        .store
        .update_child(subject, &profile_id, name, avatar, now())
        .await?;
    if let Some(minute) = changes.reminder_minute {
        profile = state
            .store
            .update_reminder_minute(subject, &profile_id, minute, now())
            .await?;
    }
    let profile = profile.ok_or_else(|| fail(StatusCode::NOT_FOUND, "profile_not_found"))?;
    Ok(ok(json!({ "profile": profile_json(&profile) })))
}

async fn update_learning_paths(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
    bytes: Bytes,
) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    let settings: LearningPathSettings = body(&bytes, "invalid_learning_paths")?;
    // The catalogue offers the Lefff's verbs; the engine alone would conjugate any -er word.
    let verbs_offered = settings.conjugation.as_ref().is_none_or(|conjugation| {
        conjugation
            .verbs
            .iter()
            .all(|verb| lt_domain::conjugation::index::contains(verb))
    });
    if !lt_domain::paths::validate_learning_paths(&settings) || !verbs_offered {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_learning_paths"));
    }
    let profile = state
        .store
        .update_learning_paths(&family.google_subject, &profile_id, &settings, now())
        .await?
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "profile_not_found"))?;
    Ok(ok(json!({ "profile": profile_json(&profile) })))
}

async fn remove_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
) -> Reply {
    let (family, _) = family(&state, &headers).await?;
    match state
        .store
        .remove_child(&family.google_subject, &profile_id)
        .await?
    {
        RemoveChildResult::LastProfile => Err(fail(StatusCode::CONFLICT, "last_profile_required")),
        RemoveChildResult::NotFound => Err(fail(StatusCode::NOT_FOUND, "profile_not_found")),
        RemoveChildResult::Removed => Ok(ok(json!({ "removedProfileId": profile_id }))),
    }
}

/* Learning ----------------------------------------------------------------------------------- */

#[derive(Deserialize)]
struct InsightsQuery {
    range: Option<String>,
    today: Option<String>,
}

/// What a parent sees in "What's hard", over the last 7 or 30 learning days. The app names its
/// own today, since learning days follow the child's time zone.
async fn insights(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
    Query(query): Query<InsightsQuery>,
) -> Reply {
    owner(&state, &headers, &profile_id).await?;
    let range_days = match query.range.as_deref() {
        None | Some("7d") => 7,
        Some("30d") => 30,
        Some(_) => return Err(fail(StatusCode::BAD_REQUEST, "invalid_range")),
    };
    let today = match query.today {
        Some(today) if chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d").is_ok() => today,
        Some(_) => return Err(fail(StatusCode::BAD_REQUEST, "invalid_day_key")),
        None => chrono::Utc::now().format("%Y-%m-%d").to_string(),
    };
    let profile = state
        .store
        .find_profile(&profile_id)
        .await?
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "profile_not_found"))?;
    let attempts = state.store.list_attempts(&profile_id).await?;
    let from = lt_domain::insights::period_start(&today, range_days);
    let earlier: Vec<_> = attempts
        .iter()
        .filter(|attempt| day_key_of(attempt) < from)
        .cloned()
        .collect();
    let utc = lt_domain::day_key::UtcDayKeys;
    let before = lt_domain::reduce(&LearningSnapshot::default(), &earlier, "UTC", &utc);
    let after = lt_domain::reduce(&before, &attempts, "UTC", &utc);
    let insights = lt_domain::insights::derive_insights(&lt_domain::insights::InsightsInput {
        after: &after,
        attempts: &attempts,
        before: &before,
        day_key_of: &day_key_of,
        learning_paths: &profile.learning_paths.unwrap_or_default(),
        range_days,
        today_key: &today,
    });
    Ok(ok(serde_json::to_value(insights).unwrap_or_default()))
}

async fn bootstrap(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
) -> Reply {
    owner(&state, &headers, &profile_id).await?;
    let profile = state
        .store
        .find_profile(&profile_id)
        .await?
        .ok_or_else(|| fail(StatusCode::NOT_FOUND, "profile_not_found"))?;
    let profile_state = profile_state(&state.store, &profile_id, now()).await?;
    Ok(ok(json!({
        "completedSessions": profile_state.completed_sessions,
        "gardenBloomCount": profile_state.garden_bloom_count,
        "gardenCollection": collection_json(&profile_state.collection),
        "practiceDayKeys": profile_state.practice_day_keys,
        "profile": profile_json(&profile),
        "rewardedDayKeys": profile_state.rewarded_day_keys,
        "rewards": profile_state.rewards,
        "snapshot": profile_state.snapshot,
    })))
}

#[derive(Deserialize)]
struct AttemptBatch {
    attempts: Vec<Value>,
}

async fn attempts(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
    bytes: Bytes,
) -> Reply {
    owner(&state, &headers, &profile_id).await?;
    let invalid = |message: String| {
        Failure(Box::new(json_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "invalid_attempts", "message": message }),
        )))
    };
    let batch: AttemptBatch =
        serde_json::from_slice(&bytes).map_err(|failure| invalid(failure.to_string()))?;
    if batch.attempts.len() > 100 {
        return Err(invalid("at most 100 attempts per request".to_owned()));
    }
    let events = batch
        .attempts
        .into_iter()
        .map(decode_attempt)
        .collect::<Result<Vec<_>, _>>()
        .map_err(invalid)?;
    let result = ingest(&state.store, &profile_id, events, now()).await?;
    Ok(ok(serde_json::to_value(result).unwrap_or_default()))
}

async fn introduction_seen(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
) -> Reply {
    owner(&state, &headers, &profile_id).await?;
    if state
        .store
        .mark_introduction_seen(&profile_id, now())
        .await?
        .is_none()
    {
        // The garden is created by the first bootstrap; create it now instead of failing.
        profile_state(&state.store, &profile_id, now()).await?;
        state
            .store
            .mark_introduction_seen(&profile_id, now())
            .await?;
    }
    Ok(ok(json!({ "introductionSeen": true })))
}

/* Reminders ---------------------------------------------------------------------------------- */

async fn notification_config(State(state): State<AppState>, headers: HeaderMap) -> Reply {
    caller(&state, &headers).await?;
    let vapid = state
        .config
        .vapid
        .as_ref()
        .ok_or_else(|| fail(StatusCode::SERVICE_UNAVAILABLE, "unavailable"))?;
    Ok(ok(json!({ "publicKey": vapid.public_key })))
}

#[derive(Deserialize)]
struct Keys {
    auth: String,
    p256dh: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Subscription {
    endpoint: String,
    #[serde(default)]
    expiration_time: Option<f64>,
    keys: Keys,
    locale: String,
    timezone: String,
}

async fn subscribe(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
    bytes: Bytes,
) -> Reply {
    owner(&state, &headers, &profile_id).await?;
    let input: Subscription = body(&bytes, "invalid_subscription")?;
    let valid = ["en", "fr", "zh-Hans"].contains(&input.locale.as_str())
        && input.endpoint.starts_with("https://")
        && !input.keys.auth.is_empty()
        && !input.keys.p256dh.is_empty()
        && input.expiration_time.is_none_or(|time| time >= 0.0);
    if !valid {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_subscription"));
    }
    if chrono_tz::Tz::from_str_insensitive(&input.timezone).is_err() {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_timezone"));
    }
    state
        .store
        .upsert_push_subscription(
            &PushSubscription {
                endpoint: input.endpoint,
                expiration_time: input.expiration_time,
                keys_auth: input.keys.auth,
                keys_p256dh: input.keys.p256dh,
                last_sent_day_key: None,
                locale: input.locale,
                profile_id,
                reminder_minute: None,
                timezone: input.timezone,
            },
            now(),
        )
        .await?;
    Ok(ok(json!({ "status": "subscribed" })))
}

#[derive(Deserialize)]
struct EndpointQuery {
    endpoint: String,
}

async fn unsubscribe(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(profile_id): Path<String>,
    Query(query): Query<EndpointQuery>,
) -> Reply {
    owner(&state, &headers, &profile_id).await?;
    state
        .store
        .remove_push_subscription(&profile_id, &query.endpoint)
        .await?;
    Ok(ok(json!({ "status": "unsubscribed" })))
}

/* Access list -------------------------------------------------------------------------------- */

async fn administrator(state: &AppState, headers: &HeaderMap) -> Result<SessionClaims, Failure> {
    if state.config.auth.is_none() {
        return Err(fail(StatusCode::UNAUTHORIZED, "unauthorized"));
    }
    let identity = caller(state, headers).await?;
    if !state.is_admin(&identity.email) {
        return Err(fail(StatusCode::FORBIDDEN, "forbidden"));
    }
    Ok(identity)
}

async fn list_emails(State(state): State<AppState>, headers: HeaderMap) -> Reply {
    administrator(&state, &headers).await?;
    let emails: Vec<Value> = state
        .access_list()
        .await?
        .into_iter()
        .map(|email| json!({ "admin": state.is_admin(&email), "email": email }))
        .collect();
    Ok(ok(json!({ "emails": emails })))
}

#[derive(Deserialize)]
struct EmailInput {
    email: String,
}

async fn add_email(State(state): State<AppState>, headers: HeaderMap, bytes: Bytes) -> Reply {
    let actor = administrator(&state, &headers).await?;
    let input: EmailInput = body(&bytes, "invalid_email")?;
    let email = normalize_email(&input.email)
        .ok_or_else(|| fail(StatusCode::BAD_REQUEST, "invalid_email"))?;
    let created = state.store.allow_email(&email, &actor.email, now()).await?;
    Ok(json_response(
        if created {
            StatusCode::CREATED
        } else {
            StatusCode::OK
        },
        json!({ "created": created, "email": email }),
    ))
}

async fn remove_email(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(email): Path<String>,
) -> Reply {
    let actor = administrator(&state, &headers).await?;
    let email =
        normalize_email(&email).ok_or_else(|| fail(StatusCode::BAD_REQUEST, "invalid_email"))?;
    if state.is_admin(&email) {
        return Err(fail(StatusCode::CONFLICT, "protected_email"));
    }
    let removed = state.revoke(&email, &actor.email).await?;
    Ok(ok(json!({ "email": email, "removed": removed })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_reminders_between_seven_and_nine_by_quarter_hours() {
        assert!(is_valid_reminder_minute(18 * 60));
        assert!(is_valid_reminder_minute(7 * 60));
        assert!(is_valid_reminder_minute(21 * 60));
        assert!(!is_valid_reminder_minute(21 * 60 + 15));
        assert!(!is_valid_reminder_minute(18 * 60 + 5));
        assert!(!is_valid_reminder_minute(6 * 60 + 45));
    }
}

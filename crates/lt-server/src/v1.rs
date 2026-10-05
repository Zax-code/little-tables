//! The `/api/v1` contract of the previous server, reproduced exactly so that the current web app
//! keeps working until the new one replaces it (removed in lot 5).

use axum::Router;
use axum::body::Bytes;
use std::time::Instant;

use axum::extract::State;
use axum::http::{Extensions, HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use lt_auth::{SESSION_COOKIE, SESSION_LIFETIME_MS, SessionClaims, normalize_email};
use lt_domain::model::LearningPathSettings;
use lt_store::{Family, PushSubscription, RemoveChildResult};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use crate::bootstrap::v1_bootstrap;
use crate::ingestion::{decode_v1_sync, ingest};
use crate::limits::client_ip;
use crate::state::{AppState, cookie, now};

pub(crate) const SELECTABLE_AVATARS: [&str; 6] = [
    "sprout",
    "malo-bear",
    "fenna-fox",
    "mina-cat",
    "paco-dog",
    "colin-mallard",
];
pub(crate) const DEFAULT_AVATAR: &str = "sprout";
const REMINDER_HOUR: i64 = 18;

pub fn json_response(status: StatusCode, body: Value) -> Response {
    (status, axum::Json(body)).into_response()
}

pub fn ok(body: Value) -> Response {
    json_response(StatusCode::OK, body)
}

pub fn error(status: StatusCode, code: &str) -> Response {
    json_response(status, json!({ "error": code }))
}

fn unauthorized() -> Response {
    error(StatusCode::UNAUTHORIZED, "unauthorized")
}

fn parse<T: DeserializeOwned>(body: &[u8]) -> Option<T> {
    serde_json::from_slice(body).ok()
}

/// `NonEmptyTrimmedString` of at most 40 characters.
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

/// The first profile keeps the historical id `lou` only for an administrator, who owned the
/// single shared learner of the first deployment.
pub(crate) fn legacy_profile_id<'a>(
    state: &AppState,
    email: &str,
    profile_id: &'a str,
) -> Option<&'a str> {
    state.is_admin(email).then_some(profile_id)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/status", get(auth_status))
        .route("/api/v1/auth/google", post(google_sign_in))
        .route("/api/v1/profile/name", put(save_preferred_name))
        .route(
            "/api/v1/family/profiles",
            get(list_family_profiles)
                .post(create_child_profile)
                .put(update_child_profile)
                .delete(remove_child_profile),
        )
        .route(
            "/api/v1/family/profiles/learning-paths",
            put(update_learning_paths),
        )
        .route(
            "/api/v1/admin/allowed-emails",
            get(list_allowed_emails)
                .post(add_allowed_email)
                .delete(remove_allowed_email),
        )
        .route("/api/v1/session/refresh", post(refresh_session))
        .route("/api/v1/bootstrap", get(bootstrap))
        .route(
            "/api/v1/garden/introduction-seen",
            post(mark_garden_introduction_seen),
        )
        .route("/api/v1/attempts/sync", post(sync))
        .route("/api/v1/notifications/config", get(notification_config))
        .route(
            "/api/v1/notifications/subscriptions",
            post(save_push_subscription).delete(remove_push_subscription),
        )
}

/* Authentication ----------------------------------------------------------------------------- */

async fn auth_status(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let identity = state.identity(&headers).await;
    let auth = state.config.auth.as_ref();
    ok(json!({
        "authenticated": identity.is_some(),
        "authenticationRequired": auth.is_some(),
        "displayName": identity.as_ref().map(|identity| identity.display_name.clone()),
        "googleClientId": auth.map(|auth| auth.google_client_id.clone()),
        "isAdmin": auth.is_some() && identity.as_ref().is_some_and(|identity| state.is_admin(&identity.email)),
        "nameChoiceRequired": identity.as_ref().is_some_and(|identity| identity.name_choice_required),
        "profileId": identity.as_ref().map(|identity| identity.profile_id.clone()),
        "sessionExpiresAt": match (auth, &identity) {
            (Some(_), Some(identity)) => json!(identity.expires_at_ms()),
            _ => Value::Null,
        },
    }))
}

#[derive(Deserialize)]
struct GoogleCredential {
    credential: String,
}

async fn google_sign_in(
    State(state): State<AppState>,
    headers: HeaderMap,
    extensions: Extensions,
    body: Bytes,
) -> Response {
    let Some(auth) = state.config.auth.clone() else {
        return error(StatusCode::NOT_FOUND, "google_auth_unavailable");
    };
    if !state
        .sign_in_limiter
        .allow(client_ip(&headers, &extensions), Instant::now())
    {
        return error(StatusCode::TOO_MANY_REQUESTS, "too_many_requests");
    }
    let invalid = || error(StatusCode::UNAUTHORIZED, "invalid_google_credential");
    let Some(GoogleCredential { credential }) =
        parse(&body).filter(|body: &GoogleCredential| !body.credential.is_empty())
    else {
        return invalid();
    };
    let identity = match state.verifier.verify(&credential).await {
        Ok(Some(identity)) => identity,
        Ok(None) | Err(_) => return invalid(),
    };
    let result: lt_store::Result<Response> = async {
        if !state.is_allowed(&identity.email).await? {
            return Ok(error(
                StatusCode::UNAUTHORIZED,
                "google_account_not_allowed",
            ));
        }
        let fallback_name = truncated_name(&identity.display_name);
        if !is_valid_name(&fallback_name) {
            return Ok(invalid());
        }
        let family = state
            .store
            .ensure_family(
                &identity.subject,
                &fallback_name,
                legacy_profile_id(&state, &identity.email, "lou"),
                DEFAULT_AVATAR,
                now(),
            )
            .await?;
        let Some(initial) = family.profiles.first() else {
            return Ok(error(
                StatusCode::SERVICE_UNAVAILABLE,
                "profile_unavailable",
            ));
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
            ok(json!({ "profileId": initial.id, "status": "authenticated" })),
            &session,
        ))
    }
    .await;
    result.unwrap_or_else(|_| invalid())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreferredName {
    display_name: String,
}

async fn save_preferred_name(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(auth) = state.config.auth.clone() else {
        return unauthorized();
    };
    let Some(identity) = state.identity(&headers).await else {
        return unauthorized();
    };
    if !identity.name_choice_required {
        return error(StatusCode::CONFLICT, "name_already_chosen");
    }
    let Some(PreferredName { display_name }) = parse(&body) else {
        return error(StatusCode::BAD_REQUEST, "invalid_display_name");
    };
    let display_name = display_name.trim().to_owned();
    if !is_valid_name(&display_name) {
        return error(StatusCode::BAD_REQUEST, "invalid_display_name");
    }
    let result: lt_store::Result<Response> = async {
        let family = match state.store.find_family(&identity.google_subject).await? {
            Some(family) => family,
            None => {
                state
                    .store
                    .ensure_family(
                        &identity.google_subject,
                        &display_name,
                        legacy_profile_id(&state, &identity.email, &identity.profile_id),
                        DEFAULT_AVATAR,
                        now(),
                    )
                    .await?
            }
        };
        let Some(initial) = family
            .profiles
            .iter()
            .find(|profile| profile.id == identity.profile_id)
            .or(family.profiles.first())
        else {
            return Ok(error(
                StatusCode::SERVICE_UNAVAILABLE,
                "display_name_save_failed",
            ));
        };
        let saved = state
            .store
            .complete_initial_profile(&identity.google_subject, &initial.id, &display_name, now())
            .await?;
        if !saved {
            return Ok(error(StatusCode::CONFLICT, "name_already_chosen"));
        }
        let claims = SessionClaims {
            display_name: display_name.clone(),
            name_choice_required: false,
            profile_id: initial.id.clone(),
            ..SessionClaims::new(
                "",
                &identity.email,
                &identity.google_subject,
                "",
                false,
                identity.session_version,
                now(),
            )
        };
        let session = lt_auth::session::issue(&claims, &auth.session_secret);
        Ok(with_session(
            ok(json!({ "displayName": display_name })),
            &session,
        ))
    }
    .await;
    result.unwrap_or_else(|_| error(StatusCode::SERVICE_UNAVAILABLE, "display_name_save_failed"))
}

async fn refresh_session(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let Some(auth) = state.config.auth.clone() else {
        return ok(json!({ "status": "development_auth_disabled" }));
    };
    if state.identity(&headers).await.is_none() {
        return unauthorized();
    }
    let Some(current) = cookie(&headers, SESSION_COOKIE) else {
        return unauthorized();
    };
    match lt_auth::session::renew(current, &auth.session_secret, now()) {
        Some(renewed) => with_session(ok(json!({ "status": "renewed" })), &renewed),
        None => unauthorized(),
    }
}

/* Family profiles ---------------------------------------------------------------------------- */

/// The caller's family, created on first use like the previous server did.
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
            legacy_profile_id(state, &identity.email, &identity.profile_id),
            DEFAULT_AVATAR,
            now(),
        )
        .await?;
    Ok(Some((family, identity)))
}

async fn list_family_profiles(State(state): State<AppState>, headers: HeaderMap) -> Response {
    match family_for_identity(&state, &headers).await {
        Ok(Some((family, _))) => ok(json!({ "profiles": family.profiles })),
        Ok(None) => unauthorized(),
        Err(_) => error(
            StatusCode::SERVICE_UNAVAILABLE,
            "family_profiles_unavailable",
        ),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChildInput {
    avatar_id: String,
    name: String,
    #[serde(default)]
    profile_id: Option<String>,
}

/// A child body with a selectable avatar and a valid trimmed name.
fn child_input(body: &[u8], needs_profile: bool) -> Option<(String, String, Option<String>)> {
    let input: ChildInput = parse(body)?;
    let name = input.name.trim().to_owned();
    let profile_ok = !needs_profile || input.profile_id.as_deref().is_some_and(|id| !id.is_empty());
    (SELECTABLE_AVATARS.contains(&input.avatar_id.as_str()) && is_valid_name(&name) && profile_ok)
        .then_some((input.avatar_id, name, input.profile_id))
}

async fn create_child_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let result: lt_store::Result<Response> = async {
        let Some((family, _)) = family_for_identity(&state, &headers).await? else {
            return Ok(unauthorized());
        };
        let Some((avatar_id, name, _)) = child_input(&body, false) else {
            return Ok(error(StatusCode::BAD_REQUEST, "invalid_child_profile"));
        };
        let profile = state
            .store
            .add_child(&family.google_subject, &name, &avatar_id, now())
            .await?;
        Ok(json_response(
            StatusCode::CREATED,
            json!({ "profile": profile }),
        ))
    }
    .await;
    result.unwrap_or_else(|_| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "family_profile_save_failed",
        )
    })
}

async fn update_child_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let result: lt_store::Result<Response> = async {
        let Some((family, _)) = family_for_identity(&state, &headers).await? else {
            return Ok(unauthorized());
        };
        let Some((avatar_id, name, Some(profile_id))) = child_input(&body, true) else {
            return Ok(error(StatusCode::BAD_REQUEST, "invalid_child_profile"));
        };
        Ok(
            match state
                .store
                .update_child(
                    &family.google_subject,
                    &profile_id,
                    &name,
                    &avatar_id,
                    now(),
                )
                .await?
            {
                Some(profile) => ok(json!({ "profile": profile })),
                None => error(StatusCode::NOT_FOUND, "profile_not_found"),
            },
        )
    }
    .await;
    result.unwrap_or_else(|_| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "family_profile_save_failed",
        )
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LearningPathsInput {
    learning_paths: LearningPathSettings,
    profile_id: String,
}

async fn update_learning_paths(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let result: lt_store::Result<Response> = async {
        let Some((family, _)) = family_for_identity(&state, &headers).await? else {
            return Ok(unauthorized());
        };
        let Some(input) = parse::<LearningPathsInput>(&body).filter(|input| {
            !input.profile_id.is_empty() && input.learning_paths.enabled_skills.len() <= 11
        }) else {
            return Ok(error(StatusCode::BAD_REQUEST, "invalid_learning_paths"));
        };
        Ok(
            match state
                .store
                .update_learning_paths(
                    &family.google_subject,
                    &input.profile_id,
                    &input.learning_paths,
                    now(),
                )
                .await?
            {
                Some(profile) => ok(json!({ "profile": profile })),
                None => error(StatusCode::NOT_FOUND, "profile_not_found"),
            },
        )
    }
    .await;
    result.unwrap_or_else(|_| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "family_profile_save_failed",
        )
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileReference {
    profile_id: String,
}

async fn remove_child_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let result: lt_store::Result<Response> = async {
        let Some((family, _)) = family_for_identity(&state, &headers).await? else {
            return Ok(unauthorized());
        };
        let Some(ProfileReference { profile_id }) =
            parse::<ProfileReference>(&body).filter(|body| !body.profile_id.is_empty())
        else {
            return Ok(error(StatusCode::BAD_REQUEST, "invalid_child_profile"));
        };
        Ok(
            match state
                .store
                .remove_child(&family.google_subject, &profile_id)
                .await?
            {
                RemoveChildResult::LastProfile => {
                    error(StatusCode::CONFLICT, "last_profile_required")
                }
                RemoveChildResult::NotFound => error(StatusCode::NOT_FOUND, "profile_not_found"),
                RemoveChildResult::Removed => ok(json!({ "removedProfileId": profile_id })),
            },
        )
    }
    .await;
    result.unwrap_or_else(|_| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "family_profile_remove_failed",
        )
    })
}

/* Access list -------------------------------------------------------------------------------- */

/// The administrator making the request, or the response refusing it.
async fn administrator(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<SessionClaims, Box<Response>> {
    if state.config.auth.is_none() {
        return Err(Box::new(unauthorized()));
    }
    let identity = state
        .identity(headers)
        .await
        .ok_or_else(|| Box::new(unauthorized()))?;
    if !state.is_admin(&identity.email) {
        return Err(Box::new(error(StatusCode::FORBIDDEN, "forbidden")));
    }
    Ok(identity)
}

#[derive(Deserialize)]
struct EmailInput {
    email: String,
}

async fn list_allowed_emails(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = administrator(&state, &headers).await {
        return *response;
    }
    let result = state.access_list().await;
    match result {
        Ok(emails) => ok(json!({ "emails": emails })),
        Err(_) => error(
            StatusCode::SERVICE_UNAVAILABLE,
            "allowed_emails_unavailable",
        ),
    }
}

async fn add_allowed_email(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let actor = match administrator(&state, &headers).await {
        Ok(actor) => actor,
        Err(response) => return *response,
    };
    let Some(email) = parse::<EmailInput>(&body).and_then(|input| normalize_email(&input.email))
    else {
        return error(StatusCode::BAD_REQUEST, "invalid_email");
    };
    match state.store.allow_email(&email, &actor.email, now()).await {
        Ok(created) => json_response(
            if created {
                StatusCode::CREATED
            } else {
                StatusCode::OK
            },
            json!({ "created": created, "email": email }),
        ),
        Err(_) => error(StatusCode::SERVICE_UNAVAILABLE, "allowed_email_save_failed"),
    }
}

async fn remove_allowed_email(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let actor = match administrator(&state, &headers).await {
        Ok(actor) => actor,
        Err(response) => return *response,
    };
    let Some(email) = parse::<EmailInput>(&body).and_then(|input| normalize_email(&input.email))
    else {
        return error(StatusCode::BAD_REQUEST, "invalid_email");
    };
    if state.is_admin(&email) {
        return error(StatusCode::CONFLICT, "protected_email");
    }
    let result = state.revoke(&email, &actor.email).await;
    match result {
        Ok(removed) => ok(json!({ "email": email, "removed": removed })),
        Err(_) => error(
            StatusCode::SERVICE_UNAVAILABLE,
            "allowed_email_remove_failed",
        ),
    }
}

/* Learning ----------------------------------------------------------------------------------- */

async fn sync(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    let Some(identity) = state.identity(&headers).await else {
        return unauthorized();
    };
    let invalid = |message: String| {
        json_response(
            StatusCode::BAD_REQUEST,
            json!({ "error": "invalid_sync_request", "message": message }),
        )
    };
    let request = match decode_v1_sync(&body) {
        Ok(request) => request,
        Err(message) => return invalid(message),
    };
    let profile_id = match state
        .profile_for(&identity, &headers, Some(&request.profile_id))
        .await
    {
        Ok(Some(profile_id)) => profile_id,
        Ok(None) => return error(StatusCode::FORBIDDEN, "profile_forbidden"),
        Err(failure) => return invalid(failure.to_string()),
    };
    match ingest(&state.store, &profile_id, request.attempts, now()).await {
        Ok(result) => ok(serde_json::to_value(result).unwrap_or_default()),
        Err(failure) => invalid(failure.to_string()),
    }
}

async fn bootstrap(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let Some(identity) = state.identity(&headers).await else {
        return unauthorized();
    };
    let result: lt_store::Result<Response> = async {
        let Some(profile_id) = state.profile_for(&identity, &headers, None).await? else {
            return Ok(error(StatusCode::FORBIDDEN, "profile_forbidden"));
        };
        let display_name = state
            .store
            .find_family(&identity.google_subject)
            .await?
            .and_then(|family| {
                family
                    .profiles
                    .into_iter()
                    .find(|profile| profile.id == profile_id)
            })
            .map_or_else(|| identity.display_name.clone(), |profile| profile.name);
        Ok(ok(v1_bootstrap(
            &state.store,
            &profile_id,
            &display_name,
            now(),
        )
        .await?))
    }
    .await;
    result.unwrap_or_else(|_| error(StatusCode::SERVICE_UNAVAILABLE, "bootstrap_unavailable"))
}

/// The profile selected by the request header, or `None` when the caller may not act on it.
async fn header_profile(state: &AppState, headers: &HeaderMap) -> lt_store::Result<Option<String>> {
    match state.identity(headers).await {
        Some(identity) => state.profile_for(&identity, headers, None).await,
        None => Ok(None),
    }
}

async fn mark_garden_introduction_seen(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Response {
    let result: lt_store::Result<Response> = async {
        let Some(profile_id) = header_profile(&state, &headers).await? else {
            return Ok(unauthorized());
        };
        // Like before, a profile whose garden was never created cannot see its introduction.
        Ok(
            match state
                .store
                .mark_introduction_seen(&profile_id, now())
                .await?
            {
                Some(_) => ok(json!({ "introductionSeen": true })),
                None => error(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "garden_introduction_update_failed",
                ),
            },
        )
    }
    .await;
    result.unwrap_or_else(|_| {
        error(
            StatusCode::SERVICE_UNAVAILABLE,
            "garden_introduction_update_failed",
        )
    })
}

/* Reminders ---------------------------------------------------------------------------------- */

async fn notification_config(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if !matches!(header_profile(&state, &headers).await, Ok(Some(_))) {
        return unauthorized();
    }
    match &state.config.vapid {
        Some(vapid) => ok(json!({ "publicKey": vapid.public_key, "reminderHour": REMINDER_HOUR })),
        None => error(StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
    }
}

#[derive(Deserialize)]
struct SubscriptionKeys {
    auth: String,
    p256dh: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubscriptionInput {
    endpoint: String,
    #[serde(default)]
    expiration_time: Option<f64>,
    keys: SubscriptionKeys,
}

#[derive(Deserialize)]
struct SaveSubscription {
    #[serde(default)]
    locale: Option<String>,
    subscription: SubscriptionInput,
    timezone: String,
}

fn invalid_subscription() -> Response {
    error(StatusCode::BAD_REQUEST, "invalid_subscription_request")
}

async fn save_push_subscription(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let profile_id = match header_profile(&state, &headers).await {
        Ok(Some(profile_id)) => profile_id,
        Ok(None) => return unauthorized(),
        Err(_) => return invalid_subscription(),
    };
    let Some(input) = parse::<SaveSubscription>(&body) else {
        return invalid_subscription();
    };
    let locale = input.locale.unwrap_or_else(|| "fr".to_owned());
    let subscription = input.subscription;
    let well_formed = ["en", "fr", "zh-Hans"].contains(&locale.as_str())
        && !input.timezone.is_empty()
        && !subscription.endpoint.is_empty()
        && !subscription.keys.auth.is_empty()
        && !subscription.keys.p256dh.is_empty()
        && subscription.expiration_time.is_none_or(|time| time >= 0.0);
    if !well_formed {
        return invalid_subscription();
    }
    if chrono_tz::Tz::from_str_insensitive(&input.timezone).is_err() {
        return error(StatusCode::BAD_REQUEST, "invalid_timezone");
    }
    let record = PushSubscription {
        endpoint: subscription.endpoint,
        expiration_time: subscription.expiration_time,
        keys_auth: subscription.keys.auth,
        keys_p256dh: subscription.keys.p256dh,
        last_sent_day_key: None,
        locale,
        profile_id,
        reminder_minute: None,
        timezone: input.timezone.clone(),
    };
    match state.store.upsert_push_subscription(&record, now()).await {
        Ok(()) => ok(json!({
            "reminderHour": REMINDER_HOUR,
            "status": "subscribed",
            "timezone": input.timezone,
        })),
        Err(_) => invalid_subscription(),
    }
}

#[derive(Deserialize)]
struct RemoveSubscription {
    endpoint: String,
}

async fn remove_push_subscription(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let profile_id = match header_profile(&state, &headers).await {
        Ok(Some(profile_id)) => profile_id,
        Ok(None) => return unauthorized(),
        Err(_) => return invalid_subscription(),
    };
    let Some(RemoveSubscription { endpoint }) =
        parse::<RemoveSubscription>(&body).filter(|input| !input.endpoint.is_empty())
    else {
        return invalid_subscription();
    };
    match state
        .store
        .remove_push_subscription(&profile_id, &endpoint)
        .await
    {
        Ok(()) => ok(json!({ "status": "unsubscribed" })),
        Err(_) => invalid_subscription(),
    }
}

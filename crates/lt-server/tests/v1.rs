//! The HTTP tests of the previous TypeScript server (`apps/server/src/http/*.test.ts`), ported
//! to the Rust server to prove that the `/api/v1` contract is unchanged.

mod common;

use axum::http::{Method, StatusCode, header};
use common::{OWNER, SECRET, identity, server};
use lt_auth::SessionClaims;
use lt_domain::model::{AttemptEvent, SessionKind};
use serde_json::{Value, json};

fn session_for(email: &str, version: i64) -> String {
    let claims = SessionClaims::new(
        "tester",
        email,
        &format!("subject-for-{email}"),
        "lou",
        false,
        version,
        chrono::Utc::now().timestamp_millis(),
    );
    format!(
        "little-tables-session={}",
        lt_auth::session::issue(&claims, SECRET)
    )
}

fn base_attempt() -> Value {
    json!({
        "answerMode": "keypad", "answeredAt": "2026-07-16T03:30:00.000Z", "choices": [], "correct": true,
        "eventId": "attempt-1", "factKey": "7:8", "latencyMs": 1700, "left": 7, "right": 8,
        "questionCount": 1, "selected": 56, "sequence": 0, "sessionId": "session-1",
    })
}

fn with(mut value: Value, overrides: Value) -> Value {
    for (key, field) in overrides.as_object().unwrap() {
        value[key] = field.clone();
    }
    value
}

fn stored(id: &str, session: &str, answered_at: &str, overrides: Value) -> (AttemptEvent, i64) {
    let event = lt_server::import::decode_stored_attempt(with(
        base_attempt(),
        with(
            json!({ "eventId": id, "sessionId": session, "answeredAt": answered_at }),
            overrides,
        ),
    ))
    .unwrap();
    (event, 0)
}

/* practice HTTP interface -------------------------------------------------------------------- */

#[tokio::test]
async fn accepts_and_preserves_an_operation_aware_attempt() {
    let server = server(false, &[], vec![]).await;
    let attempt = with(
        base_attempt(),
        json!({ "eventId": "division-attempt", "factKey": "divide:56:7", "learningDayKey": "2026-07-15",
                "left": 56, "operation": "divide", "right": 7, "selected": 8 }),
    );
    let reply = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &[],
            Some(json!({ "attempts": [attempt], "profileId": "lou" })),
        )
        .await;
    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(
        reply.body,
        json!({ "accepted": ["division-attempt"], "duplicates": [], "rejected": [] })
    );
    let events = server.state.store.list_attempts("lou").await.unwrap();
    assert_eq!(events[0].answered_at, 1_784_172_600_000);
    assert_eq!(events[0].learning_day_key.as_deref(), Some("2026-07-15"));
    assert_eq!(
        serde_json::to_value(events[0].operation).unwrap(),
        json!("divide")
    );
}

#[tokio::test]
async fn continues_to_accept_legacy_multiplication_attempts() {
    let server = server(false, &[], vec![]).await;
    let reply = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &[],
            Some(json!({ "attempts": [base_attempt()], "profileId": "lou" })),
        )
        .await;
    assert_eq!(reply.status, StatusCode::OK);
    let events = server.state.store.list_attempts("lou").await.unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(
        serde_json::to_value(events[0].operation).unwrap(),
        json!("multiply")
    );
}

#[tokio::test]
async fn returns_local_practice_and_reward_days_without_double_rewarding() {
    let server = server(false, &[], vec![]).await;
    let events = vec![
        stored(
            "attempt-1",
            "session-1",
            "2026-07-16T03:30:00.000Z",
            json!({ "learningDayKey": "2026-07-15" }),
        ),
        stored(
            "attempt-2",
            "session-2",
            "2026-07-16T15:00:00.000Z",
            json!({ "learningDayKey": "2026-07-15", "sessionKind": "daily-watering" }),
        ),
        stored(
            "attempt-3",
            "session-3",
            "2026-07-17T15:00:00.000Z",
            json!({ "sessionKind": "extra-practice" }),
        ),
        stored(
            "attempt-in-progress",
            "session-in-progress",
            "2026-07-16T16:00:00.000Z",
            json!({ "learningDayKey": "2026-07-16", "questionCount": 2 }),
        ),
    ];
    assert_eq!(events[1].0.session_kind, Some(SessionKind::DailyWatering));
    server
        .state
        .store
        .import_attempts("lou", &events, 0)
        .await
        .unwrap();
    let reply = server.get("/api/v1/bootstrap", &[]).await;
    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(reply.body["completedSessions"], 3);
    assert_eq!(reply.body["gardenBloomCount"], 1);
    assert_eq!(
        reply.body["practiceDayKeys"],
        json!(["2026-07-15", "2026-07-16", "2026-07-17"])
    );
    assert_eq!(reply.body["rewardedDayKeys"], json!(["2026-07-15"]));
    assert_eq!(
        reply.body["profile"],
        json!({ "displayName": "léa", "id": "lou" })
    );
    let fact = &reply.body["snapshot"]["facts"]["7:8"];
    assert!(
        fact["dueAt"]
            .as_str()
            .is_some_and(|instant| instant.ends_with('Z')),
        "{fact}"
    );
}

#[tokio::test]
async fn returns_and_durably_reconciles_the_personalized_flower_collection() {
    let server = server(false, &[], vec![]).await;
    let events: Vec<_> = ["2026-07-23", "2026-07-24", "2026-07-25"]
        .iter()
        .enumerate()
        .map(|(index, day)| {
            stored(
                &format!("daily-{index}"),
                &format!("daily-session-{index}"),
                &format!("{day}T15:00:00.000Z"),
                json!({ "learningDayKey": day, "sessionKind": "daily-watering" }),
            )
        })
        .collect();
    server
        .state
        .store
        .import_attempts("lou", &events, 0)
        .await
        .unwrap();
    let first = server.get("/api/v1/bootstrap", &[]).await.body["gardenCollection"].clone();
    let second = server.get("/api/v1/bootstrap", &[]).await.body["gardenCollection"].clone();
    let order = first["flowerOrder"].as_array().unwrap();
    assert_eq!(order.len(), 9);
    assert_eq!(
        order.iter().collect::<std::collections::HashSet<_>>().len(),
        9
    );
    assert_eq!(first["awardedFlowerIds"], json!([order[0]]));
    assert_eq!(second, first);
    let seen = server
        .send(Method::POST, "/api/v1/garden/introduction-seen", &[], None)
        .await;
    assert_eq!(seen.body, json!({ "introductionSeen": true }));
    let third = server.get("/api/v1/bootstrap", &[]).await;
    assert_eq!(third.body["gardenCollection"]["introductionSeen"], true);
}

#[tokio::test]
async fn refuses_to_mark_the_introduction_of_a_garden_never_created() {
    let server = server(false, &[], vec![]).await;
    let reply = server
        .send(Method::POST, "/api/v1/garden/introduction-seen", &[], None)
        .await;
    assert_eq!(reply.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(
        reply.body,
        json!({ "error": "garden_introduction_update_failed" })
    );
}

#[tokio::test]
async fn rejects_inconsistent_duplicate_and_repeated_answers() {
    let server = server(false, &[], vec![]).await;
    let attempts = json!([
        base_attempt(),
        base_attempt(),
        with(
            base_attempt(),
            json!({ "eventId": "same-rank", "answeredAt": "2026-07-16T03:31:00.000Z" })
        ),
        with(
            base_attempt(),
            json!({ "eventId": "wrong", "factKey": "8:7" })
        ),
        with(
            base_attempt(),
            json!({ "eventId": "lie", "correct": false })
        ),
    ]);
    let reply = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &[],
            Some(json!({ "attempts": attempts, "profileId": "lou" })),
        )
        .await;
    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(
        reply.body,
        json!({
            "accepted": ["attempt-1"],
            "duplicates": [],
            "rejected": [
                { "eventId": "attempt-1", "reason": "duplicate_in_batch" },
                { "eventId": "wrong", "reason": "inconsistent_attempt" },
                { "eventId": "lie", "reason": "inconsistent_attempt" },
                { "eventId": "same-rank", "reason": "duplicate_sequence" },
            ],
        })
    );
    let again = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &[],
            Some(json!({ "attempts": [base_attempt()], "profileId": "lou" })),
        )
        .await;
    assert_eq!(again.body["duplicates"], json!(["attempt-1"]));
    let malformed = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &[],
            Some(json!({ "attempts": [{ "eventId": "x" }], "profileId": "lou" })),
        )
        .await;
    assert_eq!(malformed.status, StatusCode::BAD_REQUEST);
    assert_eq!(malformed.body["error"], "invalid_sync_request");
}

/* notification subscriptions ----------------------------------------------------------------- */

#[tokio::test]
async fn accepts_a_browser_subscription_with_defaults_or_a_chinese_locale() {
    let server = server(false, &[], vec![]).await;
    let subscription = json!({ "endpoint": "https://push.example/subscription", "keys": { "auth": "auth-key", "p256dh": "p256dh-key" } });
    let reply = server
        .send(
            Method::POST,
            "/api/v1/notifications/subscriptions",
            &[],
            Some(json!({ "subscription": subscription, "timezone": "America/New_York" })),
        )
        .await;
    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(
        reply.body,
        json!({ "reminderHour": 18, "status": "subscribed", "timezone": "America/New_York" })
    );
    let saved = server.state.store.list_push_subscriptions().await.unwrap();
    assert_eq!(
        (saved[0].locale.as_str(), saved[0].expiration_time),
        ("fr", None)
    );
    assert_eq!(saved[0].reminder_minute, Some(1080));

    let chinese = server
        .send(
            Method::POST,
            "/api/v1/notifications/subscriptions",
            &[],
            Some(json!({ "locale": "zh-Hans", "subscription": subscription, "timezone": "Asia/Shanghai" })),
        )
        .await;
    assert_eq!(chinese.status, StatusCode::OK);
    let saved = server.state.store.list_push_subscriptions().await.unwrap();
    assert_eq!(
        (saved[0].locale.as_str(), saved[0].timezone.as_str()),
        ("zh-Hans", "Asia/Shanghai")
    );

    let invalid = server
        .send(
            Method::POST,
            "/api/v1/notifications/subscriptions",
            &[],
            Some(json!({ "subscription": subscription, "timezone": "Mars/Olympus" })),
        )
        .await;
    assert_eq!(invalid.body, json!({ "error": "invalid_timezone" }));
}

#[tokio::test]
async fn passes_the_authorized_profile_boundary_to_subscription_removal() {
    let server = server(false, &[], vec![]).await;
    let child = server
        .send(
            Method::POST,
            "/api/v1/family/profiles",
            &[],
            Some(json!({ "avatarId": "sprout", "name": "Mia" })),
        )
        .await;
    let child_id = child.body["profile"]["id"].as_str().unwrap().to_owned();
    let subscription = json!({ "endpoint": "https://push.example/subscription", "keys": { "auth": "a", "p256dh": "p" } });
    let profile = [("x-little-tables-profile-id", child_id.as_str())];
    server
        .send(
            Method::POST,
            "/api/v1/notifications/subscriptions",
            &profile,
            Some(json!({ "subscription": subscription, "timezone": "UTC" })),
        )
        .await;
    // Removing from another profile leaves the subscription in place.
    server
        .send(
            Method::DELETE,
            "/api/v1/notifications/subscriptions",
            &[],
            Some(json!({ "endpoint": "https://push.example/subscription" })),
        )
        .await;
    assert_eq!(
        server
            .state
            .store
            .list_push_subscriptions()
            .await
            .unwrap()
            .len(),
        1
    );
    let reply = server
        .send(
            Method::DELETE,
            "/api/v1/notifications/subscriptions",
            &profile,
            Some(json!({ "endpoint": "https://push.example/subscription" })),
        )
        .await;
    assert_eq!(reply.body, json!({ "status": "unsubscribed" }));
    assert!(
        server
            .state
            .store
            .list_push_subscriptions()
            .await
            .unwrap()
            .is_empty()
    );
    let foreign = server
        .send(
            Method::DELETE,
            "/api/v1/notifications/subscriptions",
            &[("x-little-tables-profile-id", "another-familys-child")],
            Some(json!({ "endpoint": "x" })),
        )
        .await;
    assert_eq!(foreign.status, StatusCode::UNAUTHORIZED);
}

/* allowed email management ------------------------------------------------------------------- */

#[tokio::test]
async fn admin_fails_closed_when_google_authentication_is_disabled() {
    let server = server(false, &[], vec![]).await;
    let added = server
        .send(
            Method::POST,
            "/api/v1/admin/allowed-emails",
            &[],
            Some(json!({ "email": "new.user@example.com" })),
        )
        .await;
    let listed = server.get("/api/v1/admin/allowed-emails", &[]).await;
    assert_eq!(
        (added.status, listed.status),
        (StatusCode::UNAUTHORIZED, StatusCode::UNAUTHORIZED)
    );
}

#[tokio::test]
async fn allows_the_signed_in_owner_and_rejects_another_user() {
    let server = server(true, &["learner@example.com"], vec![]).await;
    let owner = session_for(OWNER, 0);
    let added = server
        .send(
            Method::POST,
            "/api/v1/admin/allowed-emails",
            &[("cookie", &owner)],
            Some(json!({ "email": " New.User@Example.com " })),
        )
        .await;
    assert_eq!(added.status, StatusCode::CREATED);
    assert_eq!(
        added.body,
        json!({ "created": true, "email": "new.user@example.com" })
    );
    let again = server
        .send(
            Method::POST,
            "/api/v1/admin/allowed-emails",
            &[("cookie", &owner)],
            Some(json!({ "email": "new.user@example.com" })),
        )
        .await;
    assert_eq!(again.status, StatusCode::OK);
    let other = server
        .send(
            Method::POST,
            "/api/v1/admin/allowed-emails",
            &[("cookie", &session_for("learner@example.com", 0))],
            Some(json!({ "email": "friend@example.com" })),
        )
        .await;
    assert_eq!(other.status, StatusCode::FORBIDDEN);
    let listed = server
        .get("/api/v1/admin/allowed-emails", &[("cookie", &owner)])
        .await;
    assert_eq!(
        listed.body,
        json!({ "emails": ["learner@example.com", "new.user@example.com", OWNER] })
    );
    let protected = server
        .send(
            Method::DELETE,
            "/api/v1/admin/allowed-emails",
            &[("cookie", &owner)],
            Some(json!({ "email": OWNER })),
        )
        .await;
    assert_eq!(protected.status, StatusCode::CONFLICT);
    let invalid = server
        .send(
            Method::POST,
            "/api/v1/admin/allowed-emails",
            &[("cookie", &owner)],
            Some(json!({ "email": "nope" })),
        )
        .await;
    assert_eq!(invalid.body, json!({ "error": "invalid_email" }));
}

#[tokio::test]
async fn revokes_an_allowed_address_and_rejects_its_existing_session() {
    let server = server(true, &["configured@example.com"], vec![]).await;
    let learner = session_for("configured@example.com", 0);
    let owner = session_for(OWNER, 0);
    let status = |cookie: String| {
        let server = &server;
        async move {
            server
                .get("/api/v1/auth/status", &[("cookie", &cookie)])
                .await
                .body["authenticated"]
                .clone()
        }
    };
    assert_eq!(status(learner.clone()).await, true);
    let removed = server
        .send(
            Method::DELETE,
            "/api/v1/admin/allowed-emails",
            &[("cookie", &owner)],
            Some(json!({ "email": "configured@example.com" })),
        )
        .await;
    assert_eq!(removed.status, StatusCode::OK);
    assert_eq!(
        removed.body,
        json!({ "email": "configured@example.com", "removed": true })
    );
    assert_eq!(status(learner.clone()).await, false);
    let refresh = server
        .send(
            Method::POST,
            "/api/v1/session/refresh",
            &[("cookie", &learner)],
            None,
        )
        .await;
    assert_eq!(refresh.status, StatusCode::UNAUTHORIZED);
    let restored = server
        .send(
            Method::POST,
            "/api/v1/admin/allowed-emails",
            &[("cookie", &owner)],
            Some(json!({ "email": "configured@example.com" })),
        )
        .await;
    assert_eq!(restored.status, StatusCode::CREATED);
    assert_eq!(status(learner).await, false);
    assert_eq!(status(session_for("configured@example.com", 1)).await, true);
}

/* preferred-name HTTP interface -------------------------------------------------------------- */

#[tokio::test]
async fn starts_with_the_google_name_saves_the_first_choice_and_reuses_it() {
    let server = server(
        true,
        &["learner@example.com"],
        vec![identity(
            "signed",
            "google lou",
            "learner@example.com",
            "google-subject",
        )],
    )
    .await;
    let first = server.sign_in("signed").await;
    let status = server
        .get("/api/v1/auth/status", &[("cookie", &first)])
        .await;
    assert_eq!(status.body["displayName"], "google lou");
    assert_eq!(status.body["nameChoiceRequired"], true);
    assert_eq!(status.body["authenticationRequired"], true);
    assert_eq!(
        status.body["googleClientId"],
        "client.apps.googleusercontent.com"
    );
    assert!(status.body["sessionExpiresAt"].is_i64());
    for name in ["   ".to_owned(), "x".repeat(41)] {
        let invalid = server
            .send(
                Method::PUT,
                "/api/v1/profile/name",
                &[("cookie", &first)],
                Some(json!({ "displayName": name })),
            )
            .await;
        assert_eq!(invalid.status, StatusCode::BAD_REQUEST);
        assert_eq!(invalid.body, json!({ "error": "invalid_display_name" }));
    }
    let save = server
        .send(
            Method::PUT,
            "/api/v1/profile/name",
            &[("cookie", &first)],
            Some(json!({ "displayName": "  Lulu  " })),
        )
        .await;
    assert_eq!(save.status, StatusCode::OK);
    assert_eq!(save.body, json!({ "displayName": "Lulu" }));
    let chosen = server
        .get("/api/v1/auth/status", &[("cookie", &save.cookie())])
        .await;
    assert_eq!(
        (
            chosen.body["displayName"].clone(),
            chosen.body["nameChoiceRequired"].clone()
        ),
        (json!("Lulu"), json!(false))
    );
    let repeated = server
        .send(
            Method::PUT,
            "/api/v1/profile/name",
            &[("cookie", &first)],
            Some(json!({ "displayName": "Another name" })),
        )
        .await;
    assert_eq!(repeated.status, StatusCode::CONFLICT);
    assert_eq!(repeated.body, json!({ "error": "name_already_chosen" }));
    let next = server.sign_in("signed").await;
    let next_status = server
        .get("/api/v1/auth/status", &[("cookie", &next)])
        .await;
    assert_eq!(
        (
            next_status.body["displayName"].clone(),
            next_status.body["nameChoiceRequired"].clone()
        ),
        (json!("Lulu"), json!(false))
    );
}

#[tokio::test]
async fn refuses_unknown_credentials_and_accounts() {
    let server = server(
        true,
        &[],
        vec![identity("stranger", "sam", "sam@example.com", "sam")],
    )
    .await;
    let unknown = server
        .send(
            Method::POST,
            "/api/v1/auth/google",
            &[],
            Some(json!({ "credential": "forged" })),
        )
        .await;
    assert_eq!(
        unknown.body,
        json!({ "error": "invalid_google_credential" })
    );
    let empty = server
        .send(
            Method::POST,
            "/api/v1/auth/google",
            &[],
            Some(json!({ "credential": "" })),
        )
        .await;
    assert_eq!(empty.status, StatusCode::UNAUTHORIZED);
    let stranger = server
        .send(
            Method::POST,
            "/api/v1/auth/google",
            &[],
            Some(json!({ "credential": "stranger" })),
        )
        .await;
    assert_eq!(
        stranger.body,
        json!({ "error": "google_account_not_allowed" })
    );
}

#[tokio::test]
async fn gives_the_owner_the_historical_profile_and_marks_the_cookie_safely() {
    let server = server(
        true,
        &[],
        vec![identity("owner", "zak", OWNER, "owner-subject")],
    )
    .await;
    let reply = server
        .send(
            Method::POST,
            "/api/v1/auth/google",
            &[],
            Some(json!({ "credential": "owner" })),
        )
        .await;
    assert_eq!(
        reply.body,
        json!({ "profileId": "lou", "status": "authenticated" })
    );
    let set_cookie = reply
        .headers
        .get(header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap();
    for attribute in [
        "Max-Age=2592000",
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
    ] {
        assert!(set_cookie.contains(attribute), "{set_cookie}");
    }
    let status = server
        .get("/api/v1/auth/status", &[("cookie", &reply.cookie())])
        .await;
    assert_eq!(status.body["isAdmin"], true);
    let refreshed = server
        .send(
            Method::POST,
            "/api/v1/session/refresh",
            &[("cookie", &reply.cookie())],
            None,
        )
        .await;
    assert_eq!(refreshed.body, json!({ "status": "renewed" }));
    assert!(refreshed.cookie().starts_with("little-tables-session="));
}

/* family-profile HTTP interface -------------------------------------------------------------- */

#[tokio::test]
async fn lets_one_account_manage_family_members_without_removing_the_last() {
    let server = server(
        true,
        &["parent@example.com"],
        vec![identity(
            "signed",
            "Google Lou",
            "parent@example.com",
            "family-google-subject",
        )],
    )
    .await;
    let unauthenticated = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &[],
            Some(json!({ "attempts": [], "profileId": "unknown-child" })),
        )
        .await;
    assert_eq!(unauthenticated.status, StatusCode::UNAUTHORIZED);
    let cookie = server.sign_in("signed").await;
    let auth = [("cookie", cookie.as_str())];
    let family = |method: Method, body: Option<Value>| {
        let server = &server;
        async move {
            server
                .send(method, "/api/v1/family/profiles", &auth, body)
                .await
        }
    };

    let initial = family(Method::GET, None).await;
    assert_eq!(initial.status, StatusCode::OK);
    let profiles = initial.body["profiles"].as_array().unwrap().clone();
    assert_eq!(profiles.len(), 1);
    assert_eq!(
        (profiles[0]["avatarId"].clone(), profiles[0]["name"].clone()),
        (json!("sprout"), json!("Google Lou"))
    );
    assert_ne!(
        profiles[0]["id"], "lou",
        "only the owner keeps the historical profile"
    );

    let retired = family(
        Method::POST,
        Some(json!({ "avatarId": "bluebell", "name": "Old preset" })),
    )
    .await;
    assert_eq!(retired.status, StatusCode::BAD_REQUEST);
    let added = family(
        Method::POST,
        Some(json!({ "avatarId": "colin-mallard", "name": "Mia" })),
    )
    .await;
    assert_eq!(added.status, StatusCode::CREATED);
    let added_id = added.body["profile"]["id"].as_str().unwrap().to_owned();
    assert_eq!(
        added.body["profile"],
        json!({ "avatarId": "colin-mallard", "id": added_id, "name": "Mia" })
    );

    let retired_update = family(
        Method::PUT,
        Some(json!({ "avatarId": "berry", "name": "Mimi", "profileId": added_id })),
    )
    .await;
    assert_eq!(retired_update.status, StatusCode::BAD_REQUEST);

    let learning_paths = json!({
        "enabledSkills": ["fraction-read"], "focusSkill": "fraction-read",
        "mode": "automatic", "subtractionMethod": "decomposition",
    });
    let saved = server
        .send(
            Method::PUT,
            "/api/v1/family/profiles/learning-paths",
            &auth,
            Some(json!({ "learningPaths": learning_paths, "profileId": added_id })),
        )
        .await;
    assert_eq!(saved.status, StatusCode::OK);
    assert_eq!(saved.body["profile"]["learningPaths"], learning_paths);
    let invalid = server
        .send(
            Method::PUT,
            "/api/v1/family/profiles/learning-paths",
            &auth,
            Some(json!({ "learningPaths": with(learning_paths.clone(), json!({ "focusSkill": "algebra" })), "profileId": added_id })),
        )
        .await;
    assert_eq!(invalid.status, StatusCode::BAD_REQUEST);

    let renamed = family(
        Method::PUT,
        Some(json!({ "avatarId": "sprout", "name": "Mimi", "profileId": added_id })),
    )
    .await;
    assert_eq!(renamed.status, StatusCode::OK);
    assert_eq!(
        renamed.body,
        json!({ "profile": { "avatarId": "sprout", "id": added_id, "learningPaths": learning_paths, "name": "Mimi" } })
    );
    let after = family(Method::GET, None).await.body["profiles"].clone();
    assert_eq!(after[0]["id"], profiles[0]["id"]);
    assert_eq!(after[1]["id"], json!(added_id));

    let returning = server.sign_in("signed").await;
    let restored = server
        .get("/api/v1/family/profiles", &[("cookie", &returning)])
        .await;
    assert_eq!(restored.body["profiles"], after);

    let unknown = family(
        Method::PUT,
        Some(json!({ "avatarId": "sprout", "name": "Mimi", "profileId": "nobody" })),
    )
    .await;
    assert_eq!(unknown.status, StatusCode::NOT_FOUND);
    let removed = family(Method::DELETE, Some(json!({ "profileId": added_id }))).await;
    assert_eq!(removed.body, json!({ "removedProfileId": added_id }));
    let last = family(
        Method::DELETE,
        Some(json!({ "profileId": profiles[0]["id"] })),
    )
    .await;
    assert_eq!(last.status, StatusCode::CONFLICT);
    assert_eq!(last.body, json!({ "error": "last_profile_required" }));
}

fn sync_body(event_id: &str, session_id: &str, profile_id: &str) -> Value {
    json!({
        "attempts": [with(base_attempt(), json!({
            "answeredAt": "2026-07-25T12:00:01.000Z", "eventId": event_id, "latencyMs": 1500,
            "operation": "multiply", "sessionId": session_id,
        }))],
        "profileId": profile_id,
    })
}

#[tokio::test]
async fn accepts_practice_only_for_owned_members_with_isolated_snapshots() {
    let server = server(
        true,
        &["parent@example.com"],
        vec![identity(
            "signed",
            "Google Lou",
            "parent@example.com",
            "isolated-family-subject",
        )],
    )
    .await;
    let cookie = server.sign_in("signed").await;
    let auth = [("cookie", cookie.as_str())];
    let initial_id = server.get("/api/v1/family/profiles", &auth).await.body["profiles"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let second_id = server
        .send(
            Method::POST,
            "/api/v1/family/profiles",
            &auth,
            Some(json!({ "avatarId": "sprout", "name": "Mia" })),
        )
        .await
        .body["profile"]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let sync = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &auth,
            Some(sync_body("mia-attempt-1", "mia-session-1", &second_id)),
        )
        .await;
    assert_eq!(sync.status, StatusCode::OK);
    let bootstrap = |profile: String| {
        let server = &server;
        let cookie = cookie.clone();
        async move {
            server
                .get(
                    "/api/v1/bootstrap",
                    &[
                        ("cookie", &cookie),
                        ("x-little-tables-profile-id", &profile),
                    ],
                )
                .await
                .body
        }
    };
    let second_first = bootstrap(second_id.clone()).await;
    assert_eq!(
        (
            second_first["completedSessions"].clone(),
            second_first["gardenBloomCount"].clone()
        ),
        (json!(1), json!(1))
    );
    assert_eq!(second_first["profile"]["id"], json!(second_id));
    assert_eq!(second_first["profile"]["displayName"], "Mia");
    let initial_first = bootstrap(initial_id.clone()).await;
    assert_eq!(
        (
            initial_first["completedSessions"].clone(),
            initial_first["gardenBloomCount"].clone()
        ),
        (json!(0), json!(0))
    );

    let seen = server
        .send(
            Method::POST,
            "/api/v1/garden/introduction-seen",
            &[
                ("cookie", &cookie),
                ("x-little-tables-profile-id", &second_id),
            ],
            None,
        )
        .await;
    assert_eq!(seen.status, StatusCode::OK);
    let second_returning = bootstrap(second_id.clone()).await;
    let initial_returning = bootstrap(initial_id).await;
    assert_eq!(
        second_returning["gardenCollection"]["flowerOrder"],
        second_first["gardenCollection"]["flowerOrder"]
    );
    assert_eq!(
        second_returning["gardenCollection"]["introductionSeen"],
        true
    );
    assert_eq!(
        initial_returning["gardenCollection"]["flowerOrder"],
        initial_first["gardenCollection"]["flowerOrder"]
    );
    assert_eq!(
        initial_returning["gardenCollection"]["introductionSeen"],
        false
    );

    let forbidden = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &auth,
            Some(json!({ "attempts": [], "profileId": "another-familys-child" })),
        )
        .await;
    assert_eq!(forbidden.status, StatusCode::FORBIDDEN);
    assert_eq!(forbidden.body, json!({ "error": "profile_forbidden" }));
}

#[tokio::test]
async fn keeps_state_isolated_across_accounts_and_restores_it_after_sign_in() {
    let server = server(
        true,
        &["parent-a@example.com", "parent-b@example.com"],
        vec![
            identity(
                "account-a",
                "Parent A",
                "parent-a@example.com",
                "google-account-a",
            ),
            identity(
                "account-b",
                "Parent B",
                "parent-b@example.com",
                "google-account-b",
            ),
        ],
    )
    .await;
    let cookie_a = server.sign_in("account-a").await;
    let cookie_b = server.sign_in("account-b").await;
    let first_profile = |cookie: String| {
        let server = &server;
        async move {
            server
                .get("/api/v1/family/profiles", &[("cookie", &cookie)])
                .await
                .body["profiles"][0]["id"]
                .as_str()
                .unwrap()
                .to_owned()
        }
    };
    let profile_a = first_profile(cookie_a.clone()).await;
    let profile_b = first_profile(cookie_b.clone()).await;
    assert_ne!(profile_a, profile_b);
    let sync = server
        .send(
            Method::POST,
            "/api/v1/attempts/sync",
            &[("cookie", &cookie_a)],
            Some(sync_body(
                "account-a-attempt-1",
                "account-a-session-1",
                &profile_a,
            )),
        )
        .await;
    assert_eq!(sync.status, StatusCode::OK);
    let bootstrap = |cookie: String, profile: String| {
        let server = &server;
        async move {
            server
                .get(
                    "/api/v1/bootstrap",
                    &[
                        ("cookie", &cookie),
                        ("x-little-tables-profile-id", &profile),
                    ],
                )
                .await
        }
    };
    // The garden exists once the profile has been bootstrapped.
    bootstrap(cookie_a.clone(), profile_a.clone()).await;
    let seen = server
        .send(
            Method::POST,
            "/api/v1/garden/introduction-seen",
            &[
                ("cookie", &cookie_a),
                ("x-little-tables-profile-id", &profile_a),
            ],
            None,
        )
        .await;
    assert_eq!(seen.status, StatusCode::OK);
    let first_a = bootstrap(cookie_a.clone(), profile_a.clone()).await.body;
    let first_b = bootstrap(cookie_b.clone(), profile_b.clone()).await.body;
    assert_eq!(
        (
            first_a["completedSessions"].clone(),
            first_a["gardenCollection"]["introductionSeen"].clone()
        ),
        (json!(1), json!(true))
    );
    assert_eq!(
        (
            first_b["completedSessions"].clone(),
            first_b["gardenCollection"]["introductionSeen"].clone()
        ),
        (json!(0), json!(false))
    );
    let forbidden = bootstrap(cookie_b, profile_a.clone()).await;
    assert_eq!(forbidden.status, StatusCode::FORBIDDEN);
    assert_eq!(forbidden.body, json!({ "error": "profile_forbidden" }));
    let returning = server.sign_in("account-a").await;
    let again = bootstrap(returning, profile_a).await.body;
    assert_eq!(
        again["gardenCollection"]["flowerOrder"],
        first_a["gardenCollection"]["flowerOrder"]
    );
    assert_eq!(again["gardenBloomCount"], 1);
}

/* hosting ------------------------------------------------------------------------------------ */

#[tokio::test]
async fn serves_the_web_app_with_sign_in_redirects() {
    let server = server(
        true,
        &[],
        vec![identity("owner", "zak", OWNER, "owner-subject")],
    )
    .await;
    let redirect = server.get("/", &[]).await;
    assert_eq!(redirect.status, StatusCode::FOUND);
    assert_eq!(redirect.headers[header::LOCATION], "/sign-in");
    let sign_in = server.get("/sign-in", &[]).await;
    assert_eq!(sign_in.status, StatusCode::OK);
    assert_eq!(sign_in.headers[header::CACHE_CONTROL], "no-store");
    let asset = server.get("/assets/app.js", &[]).await;
    assert_eq!(asset.status, StatusCode::OK);
    assert!(
        asset.headers[header::CONTENT_TYPE]
            .to_str()
            .unwrap()
            .contains("javascript")
    );
    assert!(asset.headers.get(header::CACHE_CONTROL).is_none());
    let escape = server.get("/..%2F..%2Fetc%2Fpasswd", &[]).await;
    assert_eq!(escape.status, StatusCode::NOT_FOUND);
    let cookie = server.sign_in("owner").await;
    let back = server.get("/sign-in", &[("cookie", &cookie)]).await;
    assert_eq!(back.headers[header::LOCATION], "/");
    let deep = server.get("/garden", &[("cookie", &cookie)]).await;
    assert_eq!(deep.status, StatusCode::OK);
    let protected = server.get("/api/v1/bootstrap", &[]).await;
    assert_eq!(protected.status, StatusCode::UNAUTHORIZED);
    let unknown = server
        .send(Method::POST, "/api/v1/nothing", &[], None)
        .await;
    assert_eq!(unknown.status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn reports_health_and_revision() {
    let server = server(false, &[], vec![]).await;
    assert_eq!(
        server.get("/health/live", &[]).await.body,
        json!({ "status": "ok" })
    );
    assert_eq!(
        server.get("/health/ready", &[]).await.body,
        json!({ "revision": "test", "status": "ready" })
    );
    let config = server.get("/api/v1/notifications/config", &[]).await;
    assert_eq!(config.status, StatusCode::SERVICE_UNAVAILABLE);
    let status = server.get("/api/v1/auth/status", &[]).await.body;
    assert_eq!(status["authenticationRequired"], false);
    assert_eq!(status["sessionExpiresAt"], Value::Null);
    assert_eq!(status["isAdmin"], false);
    let refresh = server
        .send(Method::POST, "/api/v1/session/refresh", &[], None)
        .await;
    assert_eq!(
        refresh.body,
        json!({ "status": "development_auth_disabled" })
    );
}

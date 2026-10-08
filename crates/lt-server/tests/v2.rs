//! The `/api/v2` contract of the new web app.
//!
//! The responses recorded here are written to `tests/fixtures/v2-responses.json` (with
//! `UPDATE_CONTRACT=1`), which `packages/api-contract` decodes with its Effect schemas: a change of
//! shape on either side fails one of the two suites.

mod common;

use std::collections::BTreeMap;

use axum::http::{Method, StatusCode, header};
use common::{OWNER, Reply, Server, identity, server};
use lt_domain::model::Exercise;
use lt_domain::paths::generate_exercise;
use lt_domain::rng::Rng;
use serde_json::{Map, Value, json};

const ORIGIN: &str = "http://little-tables.test";

/// Requests as the new app sends them, keeping the session cookie it receives.
struct Client<'a> {
    server: &'a Server,
    cookie: String,
    recorded: BTreeMap<String, Value>,
}

impl<'a> Client<'a> {
    fn new(server: &'a Server) -> Self {
        Self {
            server,
            cookie: String::new(),
            recorded: BTreeMap::new(),
        }
    }

    async fn call(&mut self, method: Method, path: &str, body: Option<Value>) -> Reply {
        let headers = [
            ("host", "little-tables.test"),
            ("origin", ORIGIN),
            ("x-little-tables", "1"),
            ("cookie", self.cookie.as_str()),
        ];
        let reply = self.server.send(method, path, &headers, body).await;
        let cookie = reply.cookie();
        if !cookie.is_empty() {
            self.cookie = cookie;
        }
        reply
    }

    /// Calls and records the response under `name` for the contract fixture.
    async fn record(
        &mut self,
        name: &str,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Value {
        let reply = self.call(method, path, body).await;
        assert!(
            reply.status.is_success(),
            "{name}: {} {}",
            reply.status,
            reply.body
        );
        self.recorded.insert(name.to_owned(), reply.body.clone());
        reply.body
    }
}

fn attempt(event_id: &str, session_id: &str, sequence: i64, answered_at: i64) -> Value {
    json!({
        "answerMode": "keypad", "answeredAt": answered_at, "choices": [], "correct": true,
        "eventId": event_id, "factKey": "7:8", "latencyMs": 1500, "learningDayKey": "2026-07-25",
        "left": 7, "operation": "multiply", "questionCount": 2, "right": 8, "selected": 56,
        "sequence": sequence, "sessionId": session_id, "sessionKind": "daily-watering",
    })
}

/// The structure of a value: its keys and the JSON types of its leaves.
fn shape(value: &Value) -> Value {
    match value {
        Value::Null => json!("null"),
        Value::Bool(_) => json!("boolean"),
        Value::Number(_) => json!("number"),
        Value::String(_) => json!("string"),
        Value::Array(items) => {
            let mut shapes: Vec<Value> = Vec::new();
            for item in items {
                let item = shape(item);
                if !shapes.contains(&item) {
                    shapes.push(item);
                }
            }
            Value::Array(shapes)
        }
        Value::Object(fields) => Value::Object(
            fields
                .iter()
                .map(|(key, field)| (key.clone(), shape(field)))
                .collect::<Map<_, _>>(),
        ),
    }
}

#[tokio::test]
async fn serves_the_new_app_contract() {
    let server = server(
        true,
        &["parent@example.com"],
        vec![
            identity(
                "parent",
                "Google Lou",
                "parent@example.com",
                "family-subject",
            ),
            identity(
                "stranger",
                "Google Zoé",
                "stranger@example.com",
                "other-subject",
            ),
        ],
    )
    .await;
    let mut client = Client::new(&server);

    let signed_out = client
        .record(
            "authStatusSignedOut",
            Method::GET,
            "/api/v2/auth/status",
            None,
        )
        .await;
    assert_eq!(signed_out["authenticated"], false);
    client
        .record(
            "signIn",
            Method::POST,
            "/api/v2/auth/google",
            Some(json!({ "credential": "parent" })),
        )
        .await;
    let status = client
        .record("authStatus", Method::GET, "/api/v2/auth/status", None)
        .await;
    assert_eq!(status["onboardingRequired"], true);
    assert_eq!(status["email"], "parent@example.com");

    let onboarded = client
        .record(
            "onboarding",
            Method::POST,
            "/api/v2/family/onboarding",
            Some(json!({ "avatarId": "fenna-fox", "name": "  Léa " })),
        )
        .await;
    let lea = onboarded["profile"]["id"].as_str().unwrap().to_owned();
    assert_eq!(onboarded["profile"]["name"], "Léa");
    assert_eq!(onboarded["profile"]["avatarId"], "fenna-fox");
    assert_eq!(onboarded["profile"]["reminderMinute"], 1080);
    let again = client
        .call(
            Method::POST,
            "/api/v2/family/onboarding",
            Some(json!({ "name": "Zoé" })),
        )
        .await;
    assert_eq!(again.status, StatusCode::CONFLICT);
    parent_code(&mut client).await;

    let created = client
        .record(
            "createProfile",
            Method::POST,
            "/api/v2/family/profiles",
            Some(json!({ "avatarId": "malo-bear", "name": "Tom" })),
        )
        .await;
    let tom = created["profile"]["id"].as_str().unwrap().to_owned();
    let updated = client
        .record(
            "updateProfile",
            Method::PATCH,
            &format!("/api/v2/family/profiles/{tom}"),
            Some(json!({ "reminderMinute": null, "name": "Tommy" })),
        )
        .await;
    assert_eq!(updated["profile"]["reminderMinute"], Value::Null);
    assert_eq!(updated["profile"]["avatarId"], "malo-bear");
    let off_hours = client
        .call(
            Method::PATCH,
            &format!("/api/v2/family/profiles/{tom}"),
            Some(json!({ "reminderMinute": 23 * 60 })),
        )
        .await;
    assert_eq!(off_hours.status, StatusCode::BAD_REQUEST);
    client
        .record(
            "updateLearningPaths",
            Method::PUT,
            &format!("/api/v2/family/profiles/{tom}/learning-paths"),
            Some(json!({
                "enabledSkills": ["column-subtraction"], "focusSkill": null,
                "mode": "manual", "subtractionMethod": "decomposition",
                "conjugation": {
                    "verbs": ["finir", "apercevoir"], "tenses": ["present", "imperfect"],
                    "focus": { "verb": "finir", "tense": null },
                },
            })),
        )
        .await;
    // A verb the catalogue does not offer, a focus on an unticked tense, or the conjugation skill
    // among the maths skills are refused.
    for conjugation in [
        json!({ "verbs": ["chantonnaillerer"], "tenses": ["present"], "focus": null }),
        json!({ "verbs": ["finir"], "tenses": ["present"], "focus": { "verb": "finir", "tense": "future" } }),
    ] {
        let refused = client
            .call(
                Method::PUT,
                &format!("/api/v2/family/profiles/{tom}/learning-paths"),
                Some(json!({
                    "enabledSkills": [], "focusSkill": null, "mode": "manual",
                    "subtractionMethod": "compensation", "conjugation": conjugation,
                })),
            )
            .await;
        assert_eq!(refused.status, StatusCode::BAD_REQUEST);
    }
    let conjugation_attempts: Vec<Value> = [(false, 5), (true, 9)]
        .into_iter()
        .enumerate()
        .map(|(sequence, (recall, seed))| {
            let Some(Exercise::Conjugation(exercise)) =
                generate_exercise("conj:finir:present", &mut Rng::new(seed), recall)
            else {
                panic!("a conjugation exercise");
            };
            json!({
                "answerMode": if recall { "keypad" } else { "choice" },
                "answeredAt": 1_785_000_000_000_i64 + sequence as i64 * 4_000,
                "choices": [], "correct": true, "eventId": format!("c{sequence}"),
                "exercise": Exercise::Conjugation(exercise.clone()),
                "factKey": "conj:finir:present", "latencyMs": 3000,
                "learningDayKey": "2026-07-25", "left": 0, "operation": "multiply",
                "questionCount": 2, "response": { "type": "text", "value": exercise.expected },
                "right": 0, "selected": 0, "sequence": sequence, "sessionId": "c",
                "sessionKind": "extra-practice",
            })
        })
        .collect();
    let mut forged = conjugation_attempts[1].clone();
    forged["eventId"] = json!("c-forged");
    forged["sessionId"] = json!("forged");
    forged["exercise"]["expected"] = json!("finisons");
    forged["response"]["value"] = json!("finisons");
    let synced_verbs = client
        .call(
            Method::POST,
            &format!("/api/v2/profiles/{tom}/attempts"),
            Some(json!({ "attempts": [conjugation_attempts[0], conjugation_attempts[1], forged] })),
        )
        .await;
    assert_eq!(synced_verbs.status, StatusCode::OK);
    assert_eq!(synced_verbs.body["accepted"], json!(["c0", "c1"]));
    assert_eq!(
        synced_verbs.body["rejected"],
        json!([{ "eventId": "c-forged", "reason": "inconsistent_attempt" }])
    );
    let profiles = client
        .record("listProfiles", Method::GET, "/api/v2/family/profiles", None)
        .await;
    assert_eq!(profiles["profiles"].as_array().unwrap().len(), 2);

    let synced = client
        .record(
            "attempts",
            Method::POST,
            &format!("/api/v2/profiles/{lea}/attempts"),
            Some(json!({ "attempts": [
                attempt("a1", "s1", 0, 1_785_000_000_000),
                attempt("a2", "s1", 1, 1_785_000_004_000),
                attempt("a3", "s1", 1, 1_785_000_009_000),
            ] })),
        )
        .await;
    assert_eq!(synced["accepted"], json!(["a1", "a2"]));
    assert_eq!(
        synced["rejected"],
        json!([{ "eventId": "a3", "reason": "duplicate_sequence" }])
    );
    let iso = client
        .call(
            Method::POST,
            &format!("/api/v2/profiles/{lea}/attempts"),
            Some(json!({ "attempts": [with_iso_date()] })),
        )
        .await;
    assert_eq!(iso.status, StatusCode::BAD_REQUEST);
    // A meadow watering, outside the insights' week, blooms in the meadow and not in the garden.
    let meadow: Vec<Value> = (0..2)
        .map(|sequence| {
            let mut event = attempt(
                &format!("m{sequence}"),
                "s3",
                sequence,
                1_784_000_000_000 + sequence * 5_000,
            );
            event["learningDayKey"] = json!("2026-07-14");
            event["sessionKind"] = json!("meadow-watering");
            event["algorithmVersion"] = json!("3");
            event
        })
        .collect();
    let watered = client
        .call(
            Method::POST,
            &format!("/api/v2/profiles/{lea}/attempts"),
            Some(json!({ "attempts": meadow })),
        )
        .await;
    assert_eq!(watered.body["accepted"], json!(["m0", "m1"]));

    let bootstrap = client
        .record(
            "bootstrap",
            Method::GET,
            &format!("/api/v2/profiles/{lea}/bootstrap"),
            None,
        )
        .await;

    // Three wrong answers in a second session make 7×8 something to work on.
    let wrong: Vec<Value> = (0..3)
        .map(|sequence| {
            let mut event = attempt(
                &format!("w{sequence}"),
                "s2",
                sequence,
                1_785_000_100_000 + sequence * 5_000,
            );
            event["correct"] = json!(false);
            event["selected"] = json!(54);
            event["questionCount"] = json!(3);
            event
        })
        .collect();
    client
        .call(
            Method::POST,
            &format!("/api/v2/profiles/{lea}/attempts"),
            Some(json!({ "attempts": wrong })),
        )
        .await;
    let insights = client
        .record(
            "insights",
            Method::GET,
            &format!("/api/v2/profiles/{lea}/insights?range=7d&today=2026-07-27"),
            None,
        )
        .await;
    assert_eq!(insights["fromDayKey"], "2026-07-21");
    assert_eq!(insights["answers"], 5);
    assert_eq!(insights["struggles"][0]["factKey"], "7:8");
    assert_eq!(
        insights["struggles"][0]["commonWrongAnswer"],
        json!({ "type": "integer", "value": 54 })
    );
    assert_eq!(insights["regularity"]["practicedDays"], 1);
    for query in ["range=1y", "range=7d&today=27-07-2026"] {
        let refused = client
            .call(
                Method::GET,
                &format!("/api/v2/profiles/{lea}/insights?{query}"),
                None,
            )
            .await;
        assert_eq!(refused.status, StatusCode::BAD_REQUEST, "{query}");
    }
    // The daily watering and the meadow watering.
    assert_eq!(bootstrap["completedSessions"], 2);
    assert_eq!(bootstrap["gardenBloomCount"], 1);
    assert_eq!(bootstrap["meadowBloomCount"], 1);
    assert_eq!(bootstrap["meadowRewardedDayKeys"], json!(["2026-07-14"]));
    assert_eq!(bootstrap["profile"]["name"], "Léa");
    assert!(bootstrap["snapshot"]["facts"]["7:8"]["dueAt"].is_i64());
    client
        .record(
            "introductionSeen",
            Method::POST,
            &format!("/api/v2/profiles/{tom}/garden/introduction-seen"),
            None,
        )
        .await;

    let subscription = json!({
        "endpoint": "https://push.example/device", "expirationTime": null,
        "keys": { "auth": "auth", "p256dh": "p256dh" }, "locale": "en", "timezone": "Europe/Paris",
    });
    client
        .record(
            "subscribe",
            Method::POST,
            &format!("/api/v2/profiles/{lea}/notifications/subscriptions"),
            Some(subscription),
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
    client
        .record(
            "unsubscribe",
            Method::DELETE,
            &format!("/api/v2/profiles/{lea}/notifications/subscriptions?endpoint=https%3A%2F%2Fpush.example%2Fdevice"),
            None,
        )
        .await;
    assert!(
        server
            .state
            .store
            .list_push_subscriptions()
            .await
            .unwrap()
            .is_empty()
    );
    let config = client
        .call(Method::GET, "/api/v2/notifications/config", None)
        .await;
    assert_eq!(config.status, StatusCode::SERVICE_UNAVAILABLE);

    let foreign = client
        .call(Method::GET, "/api/v2/profiles/lou/bootstrap", None)
        .await;
    assert_eq!(foreign.status, StatusCode::FORBIDDEN);
    let forbidden = client
        .call(Method::GET, "/api/v2/admin/allowed-emails", None)
        .await;
    assert_eq!(forbidden.status, StatusCode::FORBIDDEN);

    let removed = client
        .record(
            "removeProfile",
            Method::DELETE,
            &format!("/api/v2/family/profiles/{tom}"),
            None,
        )
        .await;
    assert_eq!(removed["removedProfileId"], json!(tom));
    let last = client
        .call(
            Method::DELETE,
            &format!("/api/v2/family/profiles/{lea}"),
            None,
        )
        .await;
    assert_eq!(last.body, json!({ "error": "last_profile_required" }));

    let refreshed = client
        .record("refresh", Method::POST, "/api/v2/auth/refresh", None)
        .await;
    assert!(refreshed["sessionExpiresAt"].is_i64());
    let logout = client.call(Method::POST, "/api/v2/auth/logout", None).await;
    assert!(
        logout.headers[header::SET_COOKIE]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    client.recorded.insert("logout".to_owned(), logout.body);
    client.cookie.clear();
    assert_eq!(
        client
            .call(Method::GET, "/api/v2/family/profiles", None)
            .await
            .status,
        StatusCode::UNAUTHORIZED
    );

    let mut admin = Client::new(&server);
    admin.cookie = admin_cookie(&server).await;
    let added = admin
        .record(
            "addEmail",
            Method::POST,
            "/api/v2/admin/allowed-emails",
            Some(json!({ "email": "Friend@Example.com" })),
        )
        .await;
    assert_eq!(
        added,
        json!({ "created": true, "email": "friend@example.com" })
    );
    let listed = admin
        .record(
            "listEmails",
            Method::GET,
            "/api/v2/admin/allowed-emails",
            None,
        )
        .await;
    assert_eq!(
        listed["emails"],
        json!([
            { "admin": false, "email": "friend@example.com" },
            { "admin": true, "email": OWNER },
            { "admin": false, "email": "parent@example.com" },
        ])
    );
    let protected = admin
        .call(
            Method::DELETE,
            &format!("/api/v2/admin/allowed-emails/{OWNER}"),
            None,
        )
        .await;
    assert_eq!(protected.status, StatusCode::CONFLICT);
    admin
        .record(
            "removeEmail",
            Method::DELETE,
            "/api/v2/admin/allowed-emails/friend@example.com",
            None,
        )
        .await;

    client.recorded.extend(admin.recorded);
    check_contract(&client.recorded);
}

/// The parent code: set, checked, locked after five wrong attempts, reset by signing in again.
async fn parent_code(client: &mut Client<'_>) {
    let path = "/api/v2/family/parent-lock";
    let unset = client
        .record("parentLockUnset", Method::GET, path, None)
        .await;
    assert_eq!(unset["configured"], false);
    let verify_unset = client
        .call(
            Method::POST,
            "/api/v2/family/parent-lock/verify",
            Some(json!({ "pin": "2468" })),
        )
        .await;
    assert_eq!(verify_unset.status, StatusCode::NOT_FOUND);
    let invalid = client
        .call(Method::PUT, path, Some(json!({ "pin": "24a8" })))
        .await;
    assert_eq!(invalid.status, StatusCode::BAD_REQUEST);

    let set = client
        .record(
            "setParentLock",
            Method::PUT,
            path,
            Some(json!({ "pin": "2468" })),
        )
        .await;
    assert_eq!(set["pinHashParams"]["iterations"], 100_000);
    let salt = set["pinSalt"].as_str().unwrap().to_owned();
    let replaced = client
        .call(Method::PUT, path, Some(json!({ "pin": "1357" })))
        .await;
    assert_eq!(replaced.status, StatusCode::FORBIDDEN);
    assert_eq!(replaced.body["remainingAttempts"], 4);

    let verified = client
        .record(
            "verifyParentLock",
            Method::POST,
            "/api/v2/family/parent-lock/verify",
            Some(json!({ "pin": "2468" })),
        )
        .await;
    assert_eq!(verified["pinSalt"], salt.as_str());
    let status = client
        .record("parentLockStatus", Method::GET, path, None)
        .await;
    assert_eq!(
        status,
        json!({ "configured": true, "lockedUntil": null, "pinSalt": salt })
    );

    // The right code above forgot the earlier wrong one: five more lock the code.
    for remaining in (1..=4).rev() {
        let wrong = client
            .call(
                Method::POST,
                "/api/v2/family/parent-lock/verify",
                Some(json!({ "pin": "0000" })),
            )
            .await;
        assert_eq!(wrong.status, StatusCode::FORBIDDEN);
        assert_eq!(wrong.body["remainingAttempts"], remaining);
        client.recorded.insert("wrongPin".to_owned(), wrong.body);
    }
    let locked = client
        .call(
            Method::POST,
            "/api/v2/family/parent-lock/verify",
            Some(json!({ "pin": "0000" })),
        )
        .await;
    assert_eq!(locked.status, StatusCode::LOCKED);
    assert!(locked.body["lockedUntil"].is_number());
    client.recorded.insert("lockedPin".to_owned(), locked.body);
    let still_locked = client
        .call(
            Method::POST,
            "/api/v2/family/parent-lock/verify",
            Some(json!({ "pin": "2468" })),
        )
        .await;
    assert_eq!(still_locked.status, StatusCode::LOCKED);
    let status = client.call(Method::GET, path, None).await;
    assert!(status.body["lockedUntil"].is_number());

    for credential in [json!({}), json!({ "credential": "stranger" })] {
        let refused = client.call(Method::DELETE, path, Some(credential)).await;
        assert_eq!(refused.status, StatusCode::FORBIDDEN);
    }
    let reset = client
        .record(
            "resetParentLock",
            Method::DELETE,
            path,
            Some(json!({ "credential": "parent" })),
        )
        .await;
    assert_eq!(reset["configured"], false);
    let chosen = client
        .call(Method::PUT, path, Some(json!({ "pin": "1357" })))
        .await;
    assert_eq!(chosen.status, StatusCode::OK);
    assert_ne!(chosen.body["pinSalt"], salt.as_str());
}

fn with_iso_date() -> Value {
    let mut value = attempt("iso", "s9", 0, 0);
    value["answeredAt"] = json!("2026-07-25T12:00:00.000Z");
    value
}

async fn admin_cookie(server: &Server) -> String {
    let claims = lt_auth::SessionClaims::new(
        "zak",
        OWNER,
        "owner-subject",
        "lou",
        false,
        0,
        chrono::Utc::now().timestamp_millis(),
    );
    let _ = server;
    format!(
        "little-tables-session={}",
        lt_auth::session::issue(&claims, common::SECRET)
    )
}

/// Compares the recorded responses with the committed fixture, or rewrites it.
fn check_contract(recorded: &BTreeMap<String, Value>) {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/v2-responses.json"
    );
    let actual = serde_json::to_value(recorded).unwrap();
    if std::env::var("UPDATE_CONTRACT").as_deref() == Ok("1") {
        std::fs::write(path, serde_json::to_string_pretty(&actual).unwrap() + "\n").unwrap();
        return;
    }
    let committed: Value = serde_json::from_str(
        &std::fs::read_to_string(path)
            .expect("tests/fixtures/v2-responses.json is missing: run with UPDATE_CONTRACT=1"),
    )
    .unwrap();
    assert_eq!(
        shape(&actual),
        shape(&committed),
        "the v2 responses changed shape: run with UPDATE_CONTRACT=1 and update packages/api-contract"
    );
}

#[tokio::test]
async fn refuses_requests_a_cross_site_page_could_forge() {
    let server = server(false, &[], vec![]).await;
    let create = || Some(json!({ "avatarId": "sprout", "name": "Mia" }));
    let unmarked = server
        .send(
            Method::POST,
            "/api/v2/family/profiles",
            &[("origin", ORIGIN), ("host", "little-tables.test")],
            create(),
        )
        .await;
    assert_eq!(unmarked.status, StatusCode::FORBIDDEN);
    assert_eq!(unmarked.body, json!({ "error": "cross_site_request" }));
    let foreign = server
        .send(
            Method::POST,
            "/api/v2/family/profiles",
            &[
                ("origin", "https://evil.example"),
                ("host", "little-tables.test"),
                ("x-little-tables", "1"),
            ],
            create(),
        )
        .await;
    assert_eq!(foreign.status, StatusCode::FORBIDDEN);
    let cross_site = server
        .send(
            Method::POST,
            "/api/v2/family/profiles",
            &[("sec-fetch-site", "cross-site"), ("x-little-tables", "1")],
            create(),
        )
        .await;
    assert_eq!(cross_site.status, StatusCode::FORBIDDEN);
    let same_origin = server
        .send(
            Method::POST,
            "/api/v2/family/profiles",
            &[("sec-fetch-site", "same-origin"), ("x-little-tables", "1")],
            create(),
        )
        .await;
    assert_eq!(same_origin.status, StatusCode::CREATED);
    // Reads need no marker.
    assert_eq!(
        server.get("/api/v2/family/profiles", &[]).await.status,
        StatusCode::OK
    );
}

#[tokio::test]
async fn slows_down_repeated_sign_in_attempts() {
    let server = server(true, &[], vec![]).await;
    let headers = [("sec-fetch-site", "same-origin"), ("x-little-tables", "1")];
    let mut statuses = Vec::new();
    for _ in 0..21 {
        let reply = server
            .send(
                Method::POST,
                "/api/v2/auth/google",
                &headers,
                Some(json!({ "credential": "nope" })),
            )
            .await;
        statuses.push(reply.status);
    }
    assert!(
        statuses[..20]
            .iter()
            .all(|status| *status == StatusCode::UNAUTHORIZED)
    );
    assert_eq!(statuses[20], StatusCode::TOO_MANY_REQUESTS);
}

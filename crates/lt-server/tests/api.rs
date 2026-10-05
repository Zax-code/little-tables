//! Rules of the server beyond the shape of `/api/v2` (which `v2.rs` records): serving the app,
//! health, sessions, access and the boundary between families.

mod common;

use axum::http::{Method, StatusCode, header};
use common::{OWNER, SECRET, identity, server};
use lt_auth::SessionClaims;
use serde_json::{Value, json};

fn session_for(email: &str, version: i64) -> String {
    let claims = SessionClaims::new(
        "tester",
        email,
        &format!("subject-for-{email}"),
        "first",
        false,
        version,
        chrono::Utc::now().timestamp_millis(),
    );
    format!(
        "little-tables-session={}",
        lt_auth::session::issue(&claims, SECRET)
    )
}

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
    let escape = server.get("/..%2F..%2Fetc%2Fpasswd", &[]).await;
    assert_eq!(escape.status, StatusCode::NOT_FOUND);
    let cookie = server.sign_in("owner").await;
    let back = server.get("/sign-in", &[("cookie", &cookie)]).await;
    assert_eq!(back.headers[header::LOCATION], "/");
    let deep = server.get("/garden", &[("cookie", &cookie)]).await;
    assert_eq!(deep.status, StatusCode::OK);
    let protected = server.get("/api/v2/family/profiles", &[]).await;
    assert_eq!(protected.status, StatusCode::UNAUTHORIZED);
    // The previous contract is gone: nothing answers there any more.
    let previous = server.get("/api/v1/bootstrap", &[]).await;
    assert_eq!(previous.status, StatusCode::NOT_FOUND);
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
    let status = server.get("/api/v2/auth/status", &[]).await.body;
    assert_eq!(status["authenticationRequired"], false);
    assert_eq!(status["sessionExpiresAt"], Value::Null);
}

#[tokio::test]
async fn refuses_unknown_credentials_and_accounts() {
    let server = server(
        true,
        &[],
        vec![identity("stranger", "sam", "sam@example.com", "sam")],
    )
    .await;
    for (credential, code) in [
        ("forged", "invalid_google_credential"),
        ("", "invalid_google_credential"),
        ("stranger", "google_account_not_allowed"),
    ] {
        let reply = server
            .app(
                Method::POST,
                "/api/v2/auth/google",
                "",
                Some(json!({ "credential": credential })),
            )
            .await;
        assert_eq!(reply.status, StatusCode::UNAUTHORIZED, "{credential}");
        assert_eq!(reply.body, json!({ "error": code }), "{credential}");
    }
}

#[tokio::test]
async fn marks_the_session_cookie_safely_and_renews_it() {
    let server = server(
        true,
        &[],
        vec![identity("owner", "zak", OWNER, "owner-subject")],
    )
    .await;
    let reply = server
        .app(
            Method::POST,
            "/api/v2/auth/google",
            "",
            Some(json!({ "credential": "owner" })),
        )
        .await;
    let set_cookie = reply.headers[header::SET_COOKIE].to_str().unwrap();
    for attribute in [
        "Max-Age=2592000",
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
    ] {
        assert!(set_cookie.contains(attribute), "{set_cookie}");
    }
    let cookie = reply.cookie();
    let status = server
        .get("/api/v2/auth/status", &[("cookie", &cookie)])
        .await;
    assert_eq!(status.body["isAdmin"], true);
    let renewed = server
        .app(Method::POST, "/api/v2/auth/refresh", &cookie, None)
        .await;
    assert_eq!(renewed.body["status"], "renewed");
    assert!(renewed.cookie().starts_with("little-tables-session="));
}

#[tokio::test]
async fn revokes_an_address_and_rejects_its_existing_session() {
    let server = server(true, &["configured@example.com"], vec![]).await;
    let learner = session_for("configured@example.com", 0);
    let owner = session_for(OWNER, 0);
    let signed_in = |cookie: String| {
        let server = &server;
        async move {
            server
                .get("/api/v2/auth/status", &[("cookie", &cookie)])
                .await
                .body["authenticated"]
                .clone()
        }
    };
    assert_eq!(signed_in(learner.clone()).await, true);
    let removed = server
        .app(
            Method::DELETE,
            "/api/v2/admin/allowed-emails/configured@example.com",
            &owner,
            None,
        )
        .await;
    assert_eq!(removed.status, StatusCode::OK);
    assert_eq!(signed_in(learner.clone()).await, false);
    let refresh = server
        .app(Method::POST, "/api/v2/auth/refresh", &learner, None)
        .await;
    assert_eq!(refresh.status, StatusCode::UNAUTHORIZED);
    let restored = server
        .app(
            Method::POST,
            "/api/v2/admin/allowed-emails",
            &owner,
            Some(json!({ "email": "configured@example.com" })),
        )
        .await;
    assert!(restored.status.is_success());
    // The old session stays revoked; a new one works.
    assert_eq!(signed_in(learner).await, false);
    assert_eq!(
        signed_in(session_for("configured@example.com", 1)).await,
        true
    );
    let other = server
        .app(
            Method::POST,
            "/api/v2/admin/allowed-emails",
            &session_for("configured@example.com", 1),
            Some(json!({ "email": "friend@example.com" })),
        )
        .await;
    assert_eq!(other.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn keeps_each_family_to_its_own_children() {
    let server = server(
        true,
        &["a@example.com", "b@example.com"],
        vec![
            identity("a", "Ana", "a@example.com", "family-a"),
            identity("b", "Ben", "b@example.com", "family-b"),
        ],
    )
    .await;
    let ana = server.sign_in("a").await;
    let ben = server.sign_in("b").await;
    let child_of_ana = server
        .app(Method::GET, "/api/v2/family/profiles", &ana, None)
        .await
        .body["profiles"][0]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    for (method, path) in [
        (
            Method::GET,
            format!("/api/v2/profiles/{child_of_ana}/bootstrap"),
        ),
        (
            Method::GET,
            format!("/api/v2/profiles/{child_of_ana}/insights"),
        ),
        (
            Method::POST,
            format!("/api/v2/profiles/{child_of_ana}/garden/introduction-seen"),
        ),
    ] {
        let refused = server.app(method, &path, &ben, None).await;
        assert_eq!(refused.status, StatusCode::FORBIDDEN, "{path}");
    }
    let removed = server
        .app(
            Method::DELETE,
            &format!("/api/v2/family/profiles/{child_of_ana}"),
            &ben,
            None,
        )
        .await;
    assert_eq!(removed.status, StatusCode::NOT_FOUND);
    let own = server
        .app(
            Method::GET,
            &format!("/api/v2/profiles/{child_of_ana}/bootstrap"),
            &ana,
            None,
        )
        .await;
    assert_eq!(own.status, StatusCode::OK);
}

#[tokio::test]
async fn keeps_administration_closed_without_google_sign_in() {
    let server = server(false, &[], vec![]).await;
    let listed = server
        .app(Method::GET, "/api/v2/admin/allowed-emails", "", None)
        .await;
    let added = server
        .app(
            Method::POST,
            "/api/v2/admin/allowed-emails",
            "",
            Some(json!({ "email": "new.user@example.com" })),
        )
        .await;
    assert!(!listed.status.is_success() && !added.status.is_success());
}

//! The test server shared by the HTTP suites.
#![allow(dead_code)]

use std::collections::HashMap;
use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::http::{HeaderMap, Method, Request, StatusCode, header};
use http_body_util::BodyExt;
use lt_auth::GoogleIdentity;
use lt_server::config::{AuthConfig, Config};
use lt_server::state::{AppState, BoxFuture, CredentialVerifier};
use lt_store::Store;
use serde_json::{Value, json};
use tower::ServiceExt;

pub const OWNER: &str = "owner@example.com";
pub const SECRET: &str = "v1-test-session-secret";

pub struct FakeGoogle(pub HashMap<String, GoogleIdentity>);

impl CredentialVerifier for FakeGoogle {
    fn verify<'a>(
        &'a self,
        credential: &'a str,
    ) -> BoxFuture<'a, Result<Option<GoogleIdentity>, String>> {
        Box::pin(async move { Ok(self.0.get(credential).cloned()) })
    }
}

pub fn identity(
    credential: &str,
    name: &str,
    email: &str,
    subject: &str,
) -> (String, GoogleIdentity) {
    (
        credential.to_owned(),
        GoogleIdentity {
            display_name: name.to_owned(),
            email: email.to_owned(),
            subject: subject.to_owned(),
        },
    )
}

pub struct Server {
    pub app: Router,
    pub state: AppState,
    pub directory: tempfile::TempDir,
}

pub struct Reply {
    pub status: StatusCode,
    pub headers: HeaderMap,
    pub body: Value,
}

impl Reply {
    /// The `name=value` part of the session cookie set by the response.
    pub fn cookie(&self) -> String {
        self.headers
            .get(header::SET_COOKIE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .unwrap_or_default()
            .to_owned()
    }
}

pub async fn server(
    google: bool,
    allowed: &[&str],
    identities: Vec<(String, GoogleIdentity)>,
) -> Server {
    let directory = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(directory.path().join("web/assets")).unwrap();
    std::fs::write(
        directory.path().join("web/index.html"),
        "<!doctype html><title>app</title>",
    )
    .unwrap();
    std::fs::write(directory.path().join("web/assets/app.js"), "console.log(1)").unwrap();
    let mut config = Config::for_tests(
        directory.path().join("test.db"),
        directory.path().join("web"),
    );
    config.admin_emails = vec![OWNER.to_owned()];
    config.allowed_emails = allowed.iter().map(|email| (*email).to_owned()).collect();
    if google {
        config.auth = Some(AuthConfig {
            google_client_id: "client.apps.googleusercontent.com".to_owned(),
            session_secret: SECRET.to_owned(),
        });
    }
    let store = Arc::new(Store::open(&config.database_path).await.unwrap());
    let state = AppState::new(
        Arc::new(config),
        store,
        Arc::new(FakeGoogle(identities.into_iter().collect())),
    );
    state.prepare().await.unwrap();
    Server {
        app: lt_server::app(state.clone()),
        state,
        directory,
    }
}

impl Server {
    pub async fn send(
        &self,
        method: Method,
        path: &str,
        headers: &[(&str, &str)],
        body: Option<Value>,
    ) -> Reply {
        let mut request = Request::builder().method(method).uri(path);
        for (name, value) in headers {
            request = request.header(*name, *value);
        }
        let request = match body {
            Some(body) => request
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.to_string())),
            None => request.body(Body::empty()),
        }
        .unwrap();
        let response = self.app.clone().oneshot(request).await.unwrap();
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        Reply {
            status,
            headers,
            body,
        }
    }

    pub async fn get(&self, path: &str, headers: &[(&str, &str)]) -> Reply {
        self.send(Method::GET, path, headers, None).await
    }

    pub async fn sign_in(&self, credential: &str) -> String {
        let reply = self
            .send(
                Method::POST,
                "/api/v1/auth/google",
                &[],
                Some(json!({ "credential": credential })),
            )
            .await;
        assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
        reply.cookie()
    }
}

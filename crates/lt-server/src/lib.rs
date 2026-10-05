//! The little tables server.
//!
//! One process serves the API, hosts the web app build and sends the daily reminders. Data lives
//! in one SQLite file (see `lt-store`).

pub mod bootstrap;
pub mod config;
pub mod http;
pub mod import;
pub mod ingestion;
pub mod limits;
pub mod parent_lock;
pub mod state;
pub mod v2;
pub mod web;

use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::extract::{DefaultBodyLimit, Request, State};
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use serde_json::json;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::state::AppState;

const BODY_LIMIT: usize = 256 * 1024;

async fn ready(State(state): State<AppState>) -> Response {
    match state.store.health().await {
        Ok(()) => http::ok(json!({ "revision": state.config.revision, "status": "ready" })),
        Err(_) => http::json_response(
            StatusCode::SERVICE_UNAVAILABLE,
            json!({ "status": "unavailable" }),
        ),
    }
}

/// Unknown routes: reads fall through to the web app, anything else is not found.
async fn fallback(State(state): State<AppState>, request: Request) -> Response {
    if request.method() == Method::GET || request.method() == Method::HEAD {
        let (parts, _) = request.into_parts();
        web::static_web_app(State(state), parts.headers, parts.uri).await
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

/// Every route of the server.
pub fn app(state: AppState) -> Router {
    Router::new()
        .route(
            "/health/live",
            get(|| async { http::ok(json!({ "status": "ok" })) }),
        )
        .route("/health/ready", get(ready))
        .merge(v2::router(state.clone()))
        .fallback(fallback)
        .method_not_allowed_fallback(fallback)
        .layer(DefaultBodyLimit::max(BODY_LIMIT))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(30),
        ))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Opens the database, starts the reminders when VAPID keys are configured and serves until
/// the process is asked to stop.
pub async fn serve(config: config::Config) -> Result<(), Box<dyn std::error::Error>> {
    let config = Arc::new(config);
    if let Some(parent) = config
        .database_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent)?;
    }
    let store = Arc::new(lt_store::Store::open(&config.database_path).await?);
    let client_id = config
        .auth
        .as_ref()
        .map(|auth| auth.google_client_id.clone())
        .unwrap_or_default();
    let state = AppState::new(
        config.clone(),
        store.clone(),
        Arc::new(lt_auth::GoogleVerifier::new(&client_id)),
    );
    state.prepare().await?;
    if let Some(vapid) = &config.vapid {
        let sender = lt_push::PushSender::new(&vapid.private_key, &vapid.subject)?;
        tokio::spawn(lt_push::run_reminders(store.clone(), sender));
    } else {
        tracing::warn!("VAPID keys are missing: daily reminders are off");
    }
    let listener = tokio::net::TcpListener::bind((config.host, config.port)).await?;
    tracing::info!(address = %listener.local_addr()?, revision = %config.revision, "little tables is listening");
    axum::serve(
        listener,
        app(state).into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown())
    .await?;
    Ok(())
}

async fn shutdown() {
    let interrupt = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut signal) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            signal.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        () = interrupt => {},
        () = terminate => {},
    }
}

//! Shared request state: configuration, database, Google verification and the access rules.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use axum::http::HeaderMap;
use lt_auth::{GoogleIdentity, GoogleVerifier, SESSION_COOKIE, SessionClaims, normalize_email};
use lt_store::{EmailStatus, Store};

use crate::config::Config;
use crate::limits::RateLimiter;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Turns a Google ID token into an identity. `Ok(None)`: genuine token, unusable email.
pub trait CredentialVerifier: Send + Sync {
    fn verify<'a>(
        &'a self,
        credential: &'a str,
    ) -> BoxFuture<'a, Result<Option<GoogleIdentity>, String>>;
}

impl CredentialVerifier for GoogleVerifier {
    fn verify<'a>(
        &'a self,
        credential: &'a str,
    ) -> BoxFuture<'a, Result<Option<GoogleIdentity>, String>> {
        Box::pin(async move {
            GoogleVerifier::verify(self, credential)
                .await
                .map_err(|error| error.to_string())
        })
    }
}

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub store: Arc<Store>,
    pub verifier: Arc<dyn CredentialVerifier>,
    /// Sign-in attempts per client address.
    pub sign_in_limiter: Arc<RateLimiter>,
}

pub fn now() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// The value of one cookie.
pub fn cookie<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers
        .get_all(axum::http::header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .find_map(|pair| {
            let (key, value) = pair.trim().split_once('=')?;
            (key == name).then_some(value)
        })
}

impl AppState {
    pub fn new(
        config: Arc<Config>,
        store: Arc<Store>,
        verifier: Arc<dyn CredentialVerifier>,
    ) -> Self {
        Self {
            config,
            store,
            verifier,
            sign_in_limiter: Arc::new(RateLimiter::new(20, std::time::Duration::from_secs(60))),
        }
    }

    pub fn is_admin(&self, email: &str) -> bool {
        normalize_email(email).is_some_and(|email| self.config.admin_emails.contains(&email))
    }

    /// The identity used when Google sign-in is disabled.
    pub fn development_identity(&self) -> SessionClaims {
        SessionClaims {
            auth_method: "google".to_owned(),
            display_name: "léa".to_owned(),
            email: self
                .config
                .admin_emails
                .first()
                .cloned()
                .unwrap_or_else(|| "admin@localhost".to_owned()),
            expires_at: 0.0,
            google_subject: "development".to_owned(),
            name_choice_required: false,
            profile_id: "lou".to_owned(),
            session_version: 0,
        }
    }

    /// Without Google, every request acts as a development family whose first child is `lou`.
    /// Unlike the previous server, its profiles must exist: the database enforces ownership.
    pub async fn prepare(&self) -> lt_store::Result<()> {
        if self.config.auth.is_none() {
            let identity = self.development_identity();
            self.store
                .ensure_family(
                    &identity.google_subject,
                    &identity.display_name,
                    Some("lou"),
                    "sprout",
                    now(),
                )
                .await?;
        }
        Ok(())
    }

    /// Admins → blocked → deployment list → stored list.
    pub async fn is_allowed(&self, email: &str) -> lt_store::Result<bool> {
        let Some(email) = normalize_email(email) else {
            return Ok(false);
        };
        if self.config.admin_emails.contains(&email) {
            return Ok(true);
        }
        match self.store.find_email(&email).await? {
            Some(record) if record.status == EmailStatus::Blocked => Ok(false),
            _ if self.config.allowed_emails.contains(&email) => Ok(true),
            Some(_) => Ok(true),
            None => Ok(false),
        }
    }

    /// Everyone who may sign in: admins, the stored list and the deployment list minus blocked.
    pub async fn access_list(&self) -> lt_store::Result<Vec<String>> {
        let blocked = self.store.list_emails(EmailStatus::Blocked).await?;
        let mut emails = self.config.admin_emails.clone();
        emails.extend(self.store.list_emails(EmailStatus::Allowed).await?);
        emails.extend(
            self.config
                .allowed_emails
                .iter()
                .filter(|email| !blocked.contains(email))
                .cloned(),
        );
        emails.sort();
        emails.dedup();
        Ok(emails)
    }

    /// Blocks an email and ends its sessions. True when it was allowed before.
    pub async fn revoke(&self, email: &str, actor: &str) -> lt_store::Result<bool> {
        let was_allowed = self.is_allowed(email).await?;
        self.store.block_email(email, actor, now()).await?;
        Ok(was_allowed)
    }

    pub async fn session_version(&self, email: &str) -> lt_store::Result<i64> {
        let Some(email) = normalize_email(email) else {
            return Ok(0);
        };
        if self.config.admin_emails.contains(&email) {
            return Ok(0);
        }
        Ok(self
            .store
            .find_email(&email)
            .await?
            .map_or(0, |record| record.session_version))
    }

    /// The caller, when signed in with a session that is still allowed.
    pub async fn identity(&self, headers: &HeaderMap) -> Option<SessionClaims> {
        let Some(auth) = &self.config.auth else {
            return Some(self.development_identity());
        };
        let claims = lt_auth::session::verify(
            cookie(headers, SESSION_COOKIE)?,
            &auth.session_secret,
            now(),
        )?;
        let allowed = self.is_allowed(&claims.email).await.unwrap_or(false)
            && self.session_version(&claims.email).await.ok() == Some(claims.session_version);
        allowed.then_some(claims)
    }

    /// Whether the profile belongs to the caller's family.
    pub async fn owns_profile(
        &self,
        identity: &SessionClaims,
        profile_id: &str,
    ) -> lt_store::Result<bool> {
        Ok(self
            .store
            .find_family(&identity.google_subject)
            .await?
            .is_some_and(|family| {
                family
                    .profiles
                    .iter()
                    .any(|profile| profile.id == profile_id)
            }))
    }
}

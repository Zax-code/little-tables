//! Signed session cookies.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

pub const SESSION_COOKIE: &str = "little-tables-session";
pub const SESSION_LIFETIME_MS: i64 = 30 * 24 * 60 * 60 * 1000;

/// What a session cookie proves. Field order matches the previous server's payloads.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionClaims {
    pub auth_method: String,
    pub display_name: String,
    pub email: String,
    pub expires_at: f64,
    pub google_subject: String,
    #[serde(default)]
    pub name_choice_required: bool,
    pub profile_id: String,
    #[serde(default)]
    pub session_version: i64,
}

impl SessionClaims {
    pub fn new(
        display_name: &str,
        email: &str,
        google_subject: &str,
        profile_id: &str,
        name_choice_required: bool,
        session_version: i64,
        now: i64,
    ) -> Self {
        Self {
            auth_method: "google".to_owned(),
            display_name: display_name.to_owned(),
            email: email.to_owned(),
            expires_at: (now + SESSION_LIFETIME_MS) as f64,
            google_subject: google_subject.to_owned(),
            name_choice_required,
            profile_id: profile_id.to_owned(),
            session_version,
        }
    }

    pub fn expires_at_ms(&self) -> i64 {
        self.expires_at as i64
    }
}

fn mac(secret: &str) -> Hmac<Sha256> {
    Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length")
}

/// Signs the claims into a cookie value.
pub fn issue(claims: &SessionClaims, secret: &str) -> String {
    let payload = URL_SAFE_NO_PAD.encode(serde_json::to_vec(claims).expect("claims serialise"));
    let mut signer = mac(secret);
    signer.update(payload.as_bytes());
    let signature = URL_SAFE_NO_PAD.encode(signer.finalize().into_bytes());
    format!("{payload}.{signature}")
}

/// Returns the claims of a valid, unexpired session.
pub fn verify(session: &str, secret: &str, now: i64) -> Option<SessionClaims> {
    let mut parts = session.split('.');
    let (payload, signature) = (parts.next()?, parts.next()?);
    if parts.next().is_some() {
        return None;
    }
    let signature = URL_SAFE_NO_PAD
        .decode(signature.trim_end_matches('='))
        .ok()?;
    let mut verifier = mac(secret);
    verifier.update(payload.as_bytes());
    verifier.verify_slice(&signature).ok()?;
    let claims: SessionClaims =
        serde_json::from_slice(&URL_SAFE_NO_PAD.decode(payload).ok()?).ok()?;
    let valid = claims.auth_method == "google"
        && !claims.display_name.trim().is_empty()
        && !claims.email.trim().is_empty()
        && !claims.google_subject.trim().is_empty()
        && !claims.profile_id.is_empty()
        && claims.session_version >= 0
        && claims.expires_at > now as f64;
    valid.then_some(claims)
}

/// The same claims with a fresh expiry.
pub fn renew(session: &str, secret: &str, now: i64) -> Option<String> {
    let mut claims = verify(session, secret, now)?;
    claims.expires_at = (now + SESSION_LIFETIME_MS) as f64;
    Some(issue(&claims, secret))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn claims(now: i64) -> SessionClaims {
        SessionClaims::new("léa", "lea@example.com", "sub", "lou", false, 0, now)
    }

    #[test]
    fn round_trips_and_expires() {
        let token = issue(&claims(0), "secret");
        assert_eq!(verify(&token, "secret", 1), Some(claims(0)));
        assert_eq!(verify(&token, "other", 1), None);
        assert_eq!(verify(&token, "secret", SESSION_LIFETIME_MS), None);
        let renewed = renew(&token, "secret", 1000).unwrap();
        assert_eq!(
            verify(&renewed, "secret", SESSION_LIFETIME_MS)
                .unwrap()
                .expires_at_ms(),
            1000 + SESSION_LIFETIME_MS
        );
    }

    #[test]
    fn rejects_tampering() {
        let token = issue(&claims(0), "secret");
        let (payload, signature) = token.split_once('.').unwrap();
        let mut forged = claims(0);
        forged.email = "admin@example.com".to_owned();
        let forged_payload = URL_SAFE_NO_PAD.encode(serde_json::to_vec(&forged).unwrap());
        assert_eq!(
            verify(&format!("{forged_payload}.{signature}"), "secret", 1),
            None
        );
        assert_eq!(
            verify(&format!("{payload}.{signature}.x"), "secret", 1),
            None
        );
        assert_eq!(verify("garbage", "secret", 1), None);
    }

    /// A cookie issued by the previous TypeScript server for secret `s3cret`.
    #[test]
    fn accepts_sessions_of_the_previous_server() {
        let payload = URL_SAFE_NO_PAD.encode(
            r#"{"authMethod":"google","displayName":"léa","email":"lea@example.com","expiresAt":4102444800000,"googleSubject":"123","nameChoiceRequired":false,"profileId":"lou","sessionVersion":2}"#,
        );
        let mut signer = mac("s3cret");
        signer.update(payload.as_bytes());
        let token = format!(
            "{payload}.{}",
            URL_SAFE_NO_PAD.encode(signer.finalize().into_bytes())
        );
        let claims = verify(&token, "s3cret", 0).unwrap();
        assert_eq!(claims.session_version, 2);
        assert_eq!(claims.profile_id, "lou");
    }
}

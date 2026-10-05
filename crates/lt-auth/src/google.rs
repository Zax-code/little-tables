//! Google Identity Services ID tokens, verified against Google's published keys.

use std::time::{Duration, Instant};

use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use serde::Deserialize;
use tokio::sync::RwLock;

const GOOGLE_KEYS_URL: &str = "https://www.googleapis.com/oauth2/v3/certs";
const KEY_CACHE: Duration = Duration::from_secs(60 * 60);

#[derive(Clone, Debug, PartialEq)]
pub struct GoogleIdentity {
    /// Lowercase name shown until the parent chooses one.
    pub display_name: String,
    pub email: String,
    pub subject: String,
}

#[derive(Debug, Default, Deserialize)]
pub struct GoogleClaims {
    pub email: Option<String>,
    #[serde(default, deserialize_with = "boolean_or_text")]
    pub email_verified: bool,
    pub given_name: Option<String>,
    pub name: Option<String>,
    pub sub: Option<String>,
}

fn boolean_or_text<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<bool, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Flag {
        Boolean(bool),
        Text(String),
    }
    Ok(match Flag::deserialize(deserializer)? {
        Flag::Boolean(value) => value,
        Flag::Text(value) => value == "true",
    })
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

/// The identity of verified claims, named like the previous server named it.
pub fn identity_from_claims(claims: &GoogleClaims) -> Option<GoogleIdentity> {
    let email = non_empty(claims.email.as_deref())?.to_lowercase();
    let subject = claims.sub.clone().filter(|subject| !subject.is_empty())?;
    if !claims.email_verified {
        return None;
    }
    let name = non_empty(claims.given_name.as_deref())
        .or_else(|| non_empty(claims.name.as_deref()))
        .map(str::to_owned)
        .or_else(|| {
            email
                .split('@')
                .next()
                .filter(|local| !local.is_empty())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| "léa".to_owned());
    Some(GoogleIdentity {
        display_name: name.to_lowercase(),
        email,
        subject,
    })
}

#[derive(Debug, thiserror::Error)]
pub enum GoogleError {
    #[error("the Google keys could not be fetched: {0}")]
    Keys(String),
    #[error("the credential is invalid: {0}")]
    Invalid(String),
}

/// Verifies ID tokens for one OAuth client, caching Google's keys for an hour.
pub struct GoogleVerifier {
    client_id: String,
    http: reqwest::Client,
    keys: RwLock<Option<(JwkSet, Instant)>>,
    keys_url: String,
}

impl GoogleVerifier {
    pub fn new(client_id: &str) -> Self {
        Self::with_keys_url(client_id, GOOGLE_KEYS_URL)
    }

    pub fn with_keys_url(client_id: &str, keys_url: &str) -> Self {
        Self {
            client_id: client_id.to_owned(),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("HTTP client builds"),
            keys: RwLock::new(None),
            keys_url: keys_url.to_owned(),
        }
    }

    /// A verifier with fixed keys, for tests.
    pub fn with_keys(client_id: &str, keys: JwkSet) -> Self {
        let verifier = Self::new(client_id);
        *verifier.keys.try_write().expect("unshared lock") =
            Some((keys, Instant::now() + Duration::from_secs(u32::MAX.into())));
        verifier
    }

    pub fn client_id(&self) -> &str {
        &self.client_id
    }

    async fn key_set(&self, refresh: bool) -> Result<JwkSet, GoogleError> {
        if !refresh
            && let Some((keys, expires)) = self.keys.read().await.as_ref()
            && *expires > Instant::now()
        {
            return Ok(keys.clone());
        }
        let keys: JwkSet = self
            .http
            .get(&self.keys_url)
            .send()
            .await
            .and_then(reqwest::Response::error_for_status)
            .map_err(|error| GoogleError::Keys(error.to_string()))?
            .json()
            .await
            .map_err(|error| GoogleError::Keys(error.to_string()))?;
        *self.keys.write().await = Some((keys.clone(), Instant::now() + KEY_CACHE));
        Ok(keys)
    }

    /// Checks the signature, audience, issuer and expiry, then maps the claims to an identity.
    /// `Ok(None)` means the token is genuine but its email is missing or unverified.
    pub async fn verify(&self, credential: &str) -> Result<Option<GoogleIdentity>, GoogleError> {
        let header =
            decode_header(credential).map_err(|error| GoogleError::Invalid(error.to_string()))?;
        let kid = header
            .kid
            .ok_or_else(|| GoogleError::Invalid("missing key id".to_owned()))?;
        let mut keys = self.key_set(false).await?;
        if keys.find(&kid).is_none() {
            // Google rotates keys; refresh once before refusing.
            keys = self.key_set(true).await?;
        }
        let jwk = keys
            .find(&kid)
            .ok_or_else(|| GoogleError::Invalid("unknown key".to_owned()))?;
        let key =
            DecodingKey::from_jwk(jwk).map_err(|error| GoogleError::Invalid(error.to_string()))?;
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[&self.client_id]);
        validation.set_issuer(&["accounts.google.com", "https://accounts.google.com"]);
        let token = decode::<GoogleClaims>(credential, &key, &validation)
            .map_err(|error| GoogleError::Invalid(error.to_string()))?;
        Ok(identity_from_claims(&token.claims))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn claims(json: &str) -> GoogleClaims {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn names_the_identity_like_before() {
        let identity = identity_from_claims(&claims(
            r#"{"email":"Lea@Example.com","email_verified":true,"given_name":"Léa","sub":"1"}"#,
        ))
        .unwrap();
        assert_eq!(identity.email, "lea@example.com");
        assert_eq!(identity.display_name, "léa");
        let from_email = identity_from_claims(&claims(
            r#"{"email":"tom@x.fr","email_verified":"true","sub":"2"}"#,
        ))
        .unwrap();
        assert_eq!(from_email.display_name, "tom");
    }

    #[test]
    fn refuses_unverified_or_incomplete_claims() {
        assert!(
            identity_from_claims(&claims(
                r#"{"email":"a@b.c","email_verified":false,"sub":"1"}"#
            ))
            .is_none()
        );
        assert!(
            identity_from_claims(&claims(r#"{"email":"a@b.c","email_verified":true}"#)).is_none()
        );
        assert!(identity_from_claims(&claims(r#"{"email_verified":true,"sub":"1"}"#)).is_none());
    }

    #[tokio::test]
    async fn verifies_signed_tokens_and_rejects_the_wrong_audience() {
        use base64::Engine;
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use jsonwebtoken::{EncodingKey, Header, encode};
        use rsa::pkcs1::EncodeRsaPrivateKey;
        use rsa::traits::PublicKeyParts;
        // A throwaway key pair generated for this test only.
        let private = rsa::RsaPrivateKey::new(&mut rand::thread_rng(), 2048).unwrap();
        let private_pem = private.to_pkcs1_pem(rsa::pkcs1::LineEnding::LF).unwrap();
        let jwks: JwkSet = serde_json::from_value(serde_json::json!({ "keys": [{
            "kty": "RSA", "kid": "test", "alg": "RS256", "use": "sig",
            "n": URL_SAFE_NO_PAD.encode(private.n().to_bytes_be()),
            "e": URL_SAFE_NO_PAD.encode(private.e().to_bytes_be()),
        }]}))
        .unwrap();
        let verifier = GoogleVerifier::with_keys("client-1", jwks);
        let token = |audience: &str| {
            let mut header = Header::new(Algorithm::RS256);
            header.kid = Some("test".to_owned());
            encode(
                &header,
                &serde_json::json!({
                    "aud": audience, "iss": "https://accounts.google.com", "exp": 4_102_444_800_u64,
                    "sub": "42", "email": "lea@example.com", "email_verified": true, "given_name": "Léa"
                }),
                &EncodingKey::from_rsa_pem(private_pem.as_bytes()).unwrap(),
            )
            .unwrap()
        };
        let identity = verifier.verify(&token("client-1")).await.unwrap().unwrap();
        assert_eq!(identity.subject, "42");
        assert!(verifier.verify(&token("client-2")).await.is_err());
        assert!(verifier.verify("not.a.token").await.is_err());
    }
}

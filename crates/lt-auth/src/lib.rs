//! Authentication for little tables.
//!
//! Sessions keep the format of the previous server (`base64url(JSON).base64url(HMAC-SHA256)`), so
//! families stay signed in when the new server replaces it.

pub mod email;
pub mod google;
pub mod pin;
pub mod session;

pub use email::normalize_email;
pub use google::{GoogleIdentity, GoogleVerifier};
pub use session::{SESSION_COOKIE, SESSION_LIFETIME_MS, SessionClaims};

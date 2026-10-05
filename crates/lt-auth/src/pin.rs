//! The parent code: four digits, stored as an Argon2id hash.

use argon2::Argon2;
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use base64::Engine;
use base64::engine::general_purpose::STANDARD_NO_PAD;
use rand::RngCore;

/// Failures before the code locks.
pub const MAX_FAILURES: i64 = 5;
/// How long the code stays locked after too many failures.
pub const LOCK_MS: i64 = 15 * 60 * 1000;

/// Exactly four ASCII digits.
pub fn is_valid_pin(pin: &str) -> bool {
    pin.len() == 4 && pin.bytes().all(|byte| byte.is_ascii_digit())
}

pub fn hash_pin(pin: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .expect("Argon2 hashes any input")
        .to_string()
}

pub fn verify_pin(pin: &str, hash: &str) -> bool {
    PasswordHash::new(hash).is_ok_and(|parsed| {
        Argon2::default()
            .verify_password(pin.as_bytes(), &parsed)
            .is_ok()
    })
}

/// A random salt the device uses to keep its own hash of the code for offline checks.
pub fn device_salt() -> String {
    let mut bytes = [0_u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    STANDARD_NO_PAD.encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_and_verifies() {
        let hash = hash_pin("2468");
        assert!(verify_pin("2468", &hash));
        assert!(!verify_pin("1357", &hash));
        assert!(!verify_pin("2468", "not a hash"));
        assert!(is_valid_pin("0000"));
        assert!(!is_valid_pin("12a4"));
        assert!(!is_valid_pin("12345"));
        assert_ne!(device_salt(), device_salt());
    }
}

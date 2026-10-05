//! The little tables learning engine.
//!
//! Pure and deterministic: no clock, no randomness and no time zone database are read here.
//! Callers pass the current instant, the session seed and a [`day_key::DayKeys`] provider. The
//! same crate runs natively on the server and as WebAssembly in the browser, and reproduces the
//! previous TypeScript engine bit for bit (see `tests/golden.rs`).

pub mod api;
pub mod day_key;
pub mod engine;
pub mod exercises;
pub mod garden;
pub mod insights;
pub mod model;
pub mod paths;
pub mod rhythm;
pub mod rng;

pub use engine::{
    AnswerError, AnswerOutcome, LearnerAnswer, SessionInput, answer, correct_answer,
    create_session, derive_learning_progress, derive_rescue_strategies, derive_session_insight,
    empty_snapshot, reduce, validate_exercise_attempt,
};
pub use model::*;

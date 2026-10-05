//! Replays an export produced by `apps/server/src/tools/export-for-rust.ts` from a seeded MongoDB
//! (regenerate with `WRITE_EXPORT_FIXTURE=1` on its integration test). Every bootstrap computed by
//! the previous server must be reproduced exactly.

use lt_server::import::{Export, ImportError, import};
use lt_store::Store;

fn export() -> Export {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/mongo-export.json"
    );
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

async fn store() -> (Store, tempfile::TempDir) {
    let directory = tempfile::tempdir().unwrap();
    let store = Store::open(&directory.path().join("import.db"))
        .await
        .unwrap();
    (store, directory)
}

#[tokio::test]
async fn imports_the_previous_database_and_reproduces_every_bootstrap() {
    let (store, _directory) = store().await;
    let report = import(&store, export(), true, 1_790_000_000_000)
        .await
        .unwrap();
    assert_eq!(report.mismatches, Vec::<String>::new());
    assert_eq!(report.verified_bootstraps, 3);
    assert_eq!(
        (report.families, report.profiles, report.attempts),
        (2, 3, 6)
    );
    assert_eq!(
        (
            report.gardens,
            report.allowed_emails,
            report.push_subscriptions
        ),
        (3, 2, 1)
    );
    assert_eq!(
        report.orphans,
        ["attempt of removed-child", "garden of removed-child"]
    );

    let subscriptions = store.list_push_subscriptions().await.unwrap();
    assert_eq!(subscriptions[0].reminder_minute, Some(1080));
    assert_eq!(
        subscriptions[0].last_sent_day_key.as_deref(),
        Some("2026-07-02")
    );
    let family = store.find_family("owner-subject").await.unwrap().unwrap();
    assert_eq!(family.profiles[0].id, "lou");
    assert_eq!(family.profiles[1].avatar_id, "sprout");

    let again = import(&store, export(), true, 0).await;
    assert!(matches!(again, Err(ImportError::NotEmpty)));
}

#[tokio::test]
async fn refuses_to_drop_records_of_removed_profiles_silently() {
    let (store, _directory) = store().await;
    let refused = import(&store, export(), false, 0).await;
    assert!(
        matches!(&refused, Err(ImportError::Refused(message)) if message.contains("--allow-orphans")),
        "{:?}",
        refused.err()
    );
}

#[tokio::test]
async fn detects_a_bootstrap_that_differs() {
    let (store, _directory) = store().await;
    let mut export = export();
    export.expected_bootstraps[0].bootstrap["completedSessions"] = 99.into();
    let report = import(&store, export, true, 0).await.unwrap();
    assert_eq!(report.mismatches.len(), 1);
    assert!(
        report.mismatches[0].contains(".completedSessions"),
        "{:?}",
        report.mismatches
    );
}

//! `little-tables`: the server and its administration commands.

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use lt_server::config::{Config, Environment, database_path, env_lookup};
use lt_store::Store;

#[derive(Parser)]
#[command(name = "little-tables", version, about = "The little tables server")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Serve the API and the web app (the default).
    Serve,
    /// Maintenance of the database named by DATABASE_PATH.
    #[command(subcommand)]
    Admin(Admin),
}

#[derive(Subcommand)]
enum Admin {
    /// Create the database or apply pending migrations.
    Migrate,
    /// Recompute every learning snapshot from the stored events.
    RebuildSnapshots,
    /// Write a consistent copy of the database, as it is, to a new file.
    Backup { destination: PathBuf },
    /// Load a MongoDB export into an empty database and verify every bootstrap.
    Import {
        export: PathBuf,
        /// Leave out records whose profile was removed instead of refusing the import.
        #[arg(long)]
        allow_orphans: bool,
    },
}

fn init_tracing(environment: Environment) {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    let builder = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr);
    if environment == Environment::Development {
        builder.init();
    } else {
        builder.json().init();
    }
}

/// Opens the database, creating its directory and applying pending migrations.
async fn open(path: &Path) -> Result<Store, Box<dyn std::error::Error>> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent)?;
    }
    Ok(Store::open(path).await?)
}

/// Administration needs only the database, not the server's secrets.
async fn administer(command: Admin) -> Result<(), Box<dyn std::error::Error>> {
    let now = chrono::Utc::now().timestamp_millis();
    let path = database_path(&env_lookup);
    match command {
        Admin::Migrate => {
            open(&path).await?;
            println!("{} is up to date", path.display());
        }
        Admin::RebuildSnapshots => {
            let profiles = open(&path).await?.rebuild_snapshots(now).await?;
            println!("rebuilt the snapshots of {profiles} profiles");
        }
        Admin::Backup { destination } => {
            if destination.exists() {
                return Err(format!("{} already exists", destination.display()).into());
            }
            if !path.is_file() {
                return Err(format!("{} does not exist", path.display()).into());
            }
            // A backup taken before a migration must not apply it.
            Store::connect(&path).await?.backup(&destination).await?;
            println!("wrote {}", destination.display());
        }
        Admin::Import {
            export,
            allow_orphans,
        } => {
            let export =
                serde_json::from_reader(std::io::BufReader::new(std::fs::File::open(&export)?))?;
            let store = open(&path).await?;
            let report = lt_server::import::import(&store, export, allow_orphans, now).await?;
            println!(
                "imported {} families, {} profiles, {} attempts, {} gardens, {} access records, {} push subscriptions",
                report.families,
                report.profiles,
                report.attempts,
                report.gardens,
                report.allowed_emails,
                report.push_subscriptions
            );
            if !report.orphans.is_empty() {
                println!(
                    "left out {} records of removed profiles",
                    report.orphans.len()
                );
            }
            println!("verified {} bootstraps", report.verified_bootstraps);
            if !report.mismatches.is_empty() {
                for mismatch in &report.mismatches {
                    eprintln!("mismatch {mismatch}");
                }
                return Err(format!(
                    "{} bootstraps differ from the previous server: do not switch over",
                    report.mismatches.len()
                )
                .into());
            }
        }
    }
    Ok(())
}

async fn run(command: Command) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        Command::Serve => {
            let config = Config::from_env()?;
            init_tracing(config.environment);
            lt_server::serve(config).await
        }
        Command::Admin(admin) => administer(admin).await,
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli.command.unwrap_or(Command::Serve)).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("little-tables: {error}");
            ExitCode::FAILURE
        }
    }
}

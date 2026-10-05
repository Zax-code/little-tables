//! `little-tables`: the server and its administration commands.

use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use lt_server::config::{Config, Environment};
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
    /// Write a consistent copy of the database to a new file.
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

async fn open(config: &Config) -> Result<Store, Box<dyn std::error::Error>> {
    if let Some(parent) = config
        .database_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent)?;
    }
    Ok(Store::open(&config.database_path).await?)
}

async fn run(command: Command, config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let now = chrono::Utc::now().timestamp_millis();
    match command {
        Command::Serve => lt_server::serve(config).await?,
        Command::Admin(Admin::Migrate) => {
            open(&config).await?;
            println!("{} is up to date", config.database_path.display());
        }
        Command::Admin(Admin::RebuildSnapshots) => {
            let profiles = open(&config).await?.rebuild_snapshots(now).await?;
            println!("rebuilt the snapshots of {profiles} profiles");
        }
        Command::Admin(Admin::Backup { destination }) => {
            if destination.exists() {
                return Err(format!("{} already exists", destination.display()).into());
            }
            open(&config).await?.backup(&destination).await?;
            println!("wrote {}", destination.display());
        }
        Command::Admin(Admin::Import {
            export,
            allow_orphans,
        }) => {
            let export =
                serde_json::from_reader(std::io::BufReader::new(std::fs::File::open(&export)?))?;
            let store = open(&config).await?;
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

#[tokio::main]
async fn main() -> ExitCode {
    let cli = Cli::parse();
    let config = match Config::from_env() {
        Ok(config) => config,
        Err(error) => {
            eprintln!("little-tables: {error}");
            return ExitCode::FAILURE;
        }
    };
    init_tracing(config.environment);
    match run(cli.command.unwrap_or(Command::Serve), config).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("little-tables: {error}");
            ExitCode::FAILURE
        }
    }
}

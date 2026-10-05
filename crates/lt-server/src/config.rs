//! Server configuration, read once from the environment.

use std::net::IpAddr;
use std::path::PathBuf;

use lt_auth::normalize_email;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Environment {
    Development,
    Production,
    /// A disposable production-like run (container or release smoke test): production defaults,
    /// but secrets may be missing.
    Smoke,
}

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub google_client_id: String,
    pub session_secret: String,
}

#[derive(Clone, Debug)]
pub struct VapidConfig {
    pub private_key: String,
    pub public_key: String,
    pub subject: String,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub admin_emails: Vec<String>,
    /// Emails allowed by the deployment itself, in addition to the stored access list.
    pub allowed_emails: Vec<String>,
    /// `None` runs with the development identity, without Google.
    pub auth: Option<AuthConfig>,
    pub database_path: PathBuf,
    pub environment: Environment,
    pub host: IpAddr,
    pub port: u16,
    pub public_origin: Option<String>,
    pub revision: String,
    pub vapid: Option<VapidConfig>,
    pub web_dist_path: PathBuf,
}

#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct ConfigError(String);

fn emails(value: Option<String>) -> Vec<String> {
    let mut list: Vec<String> = value
        .unwrap_or_default()
        .split(',')
        .filter_map(normalize_email)
        .collect();
    list.dedup();
    list
}

/// `DATABASE_PATH`, or the deployment's default file outside development.
pub fn database_path(lookup: &impl Fn(&str) -> Option<String>) -> PathBuf {
    lookup("DATABASE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| match lookup("LT_ENV").as_deref() {
            Some("production" | "smoke") => {
                PathBuf::from("/var/lib/little-tables/little-tables.db")
            }
            _ => PathBuf::from("little-tables.db"),
        })
}

/// The environment's non-empty value of a variable.
pub fn env_lookup(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(env_lookup)
    }

    /// Reads the configuration through `lookup`, which returns a variable's non-empty value.
    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let environment = match lookup("LT_ENV").as_deref() {
            None | Some("development") => Environment::Development,
            Some("production") => Environment::Production,
            Some("smoke") => Environment::Smoke,
            Some(other) => return Err(ConfigError(format!("LT_ENV={other} is not supported."))),
        };
        let auth_disabled = match lookup("AUTH_MODE").as_deref() {
            None | Some("google") => false,
            Some("disabled") => true,
            Some(other) => return Err(ConfigError(format!("AUTH_MODE={other} is not supported."))),
        };
        if auth_disabled && environment == Environment::Production {
            return Err(ConfigError(
                "AUTH_MODE=disabled is refused in production.".to_owned(),
            ));
        }
        let google_client_id = lookup("GOOGLE_CLIENT_ID");
        let session_secret = lookup("SESSION_SECRET");
        if lookup("GOOGLE_ALLOWED_EMAILS").is_some() && google_client_id.is_none() {
            return Err(ConfigError(
                "GOOGLE_ALLOWED_EMAILS requires GOOGLE_CLIENT_ID.".to_owned(),
            ));
        }
        let auth = match (auth_disabled, google_client_id, session_secret) {
            (false, Some(google_client_id), Some(session_secret)) => Some(AuthConfig {
                google_client_id,
                session_secret,
            }),
            _ => None,
        };
        let public_origin =
            lookup("PUBLIC_ORIGIN").map(|origin| origin.trim_end_matches('/').to_owned());
        let vapid = match (lookup("VAPID_PUBLIC_KEY"), lookup("VAPID_PRIVATE_KEY")) {
            (Some(public_key), Some(private_key)) => Some(VapidConfig {
                private_key,
                public_key,
                subject: lookup("VAPID_SUBJECT")
                    .or_else(|| public_origin.clone())
                    .unwrap_or_else(|| "https://localhost".to_owned()),
            }),
            _ => None,
        };
        let admin_emails = emails(lookup("ADMIN_EMAILS"));
        if environment == Environment::Production {
            let mut missing = Vec::new();
            if auth.is_none() {
                missing.push("SESSION_SECRET, GOOGLE_CLIENT_ID");
            }
            if vapid.is_none() {
                missing.push("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY");
            }
            if admin_emails.is_empty() {
                missing.push("ADMIN_EMAILS");
            }
            if public_origin.is_none() {
                missing.push("PUBLIC_ORIGIN");
            }
            if !missing.is_empty() {
                return Err(ConfigError(format!(
                    "Production requires {}. Use LT_ENV=smoke only for a disposable smoke test.",
                    missing.join(", ")
                )));
            }
        }
        let deployed = environment != Environment::Development;
        let database_path = lookup("DATABASE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                if deployed {
                    PathBuf::from("/var/lib/little-tables/little-tables.db")
                } else {
                    PathBuf::from("little-tables.db")
                }
            });
        // A release keeps the web build next to the binary; a checkout uses the Vite output.
        let web_dist_path = lookup("WEB_DIST_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                let beside_binary = std::env::current_exe()
                    .ok()
                    .and_then(|binary| binary.parent().map(|directory| directory.join("web")));
                match beside_binary {
                    Some(path) if deployed || path.is_dir() => path,
                    _ => PathBuf::from("apps/app/dist"),
                }
            });
        let host = lookup("HOST")
            .unwrap_or_else(|| "127.0.0.1".to_owned())
            .parse()
            .map_err(|_| ConfigError("HOST must be an IP address.".to_owned()))?;
        let port = lookup("PORT")
            .unwrap_or_else(|| "3000".to_owned())
            .parse()
            .map_err(|_| ConfigError("PORT must be a port number.".to_owned()))?;
        Ok(Self {
            admin_emails,
            allowed_emails: emails(lookup("GOOGLE_ALLOWED_EMAILS")),
            auth,
            database_path,
            environment,
            host,
            port,
            public_origin,
            // A release binary knows the commit it was built from.
            revision: option_env!("APP_REVISION")
                .map(str::to_owned)
                .or_else(|| lookup("APP_REVISION"))
                .unwrap_or_else(|| "unknown".to_owned()),
            vapid,
            web_dist_path,
        })
    }

    /// A development configuration for tests.
    pub fn for_tests(database_path: PathBuf, web_dist_path: PathBuf) -> Self {
        Self {
            admin_emails: vec!["admin@example.com".to_owned()],
            allowed_emails: Vec::new(),
            auth: None,
            database_path,
            environment: Environment::Development,
            host: IpAddr::from([127, 0, 0, 1]),
            port: 0,
            public_origin: None,
            revision: "test".to_owned(),
            vapid: None,
            web_dist_path,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    fn config(pairs: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let values: HashMap<String, String> = pairs
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect();
        Config::from_lookup(|name| values.get(name).cloned())
    }

    const PRODUCTION: &[(&str, &str)] = &[
        ("LT_ENV", "production"),
        ("SESSION_SECRET", "s"),
        ("GOOGLE_CLIENT_ID", "c"),
        ("VAPID_PUBLIC_KEY", "p"),
        ("VAPID_PRIVATE_KEY", "k"),
        ("ADMIN_EMAILS", " Admin@Example.com ,bad"),
        ("PUBLIC_ORIGIN", "https://math.example/"),
    ];

    #[test]
    fn reads_a_complete_production_configuration() {
        let config = config(PRODUCTION).unwrap();
        assert_eq!(config.admin_emails, ["admin@example.com"]);
        assert_eq!(
            config.public_origin.as_deref(),
            Some("https://math.example")
        );
        assert_eq!(config.vapid.unwrap().subject, "https://math.example");
        assert_eq!(
            config.database_path,
            PathBuf::from("/var/lib/little-tables/little-tables.db")
        );
        assert!(config.auth.is_some());
    }

    #[test]
    fn refuses_an_incomplete_or_unsafe_production() {
        let error = config(&PRODUCTION[..3]).unwrap_err().to_string();
        assert!(error.contains("VAPID_PUBLIC_KEY"), "{error}");
        let mut disabled = PRODUCTION.to_vec();
        disabled.push(("AUTH_MODE", "disabled"));
        assert!(config(&disabled).is_err());
        assert!(config(&[("GOOGLE_ALLOWED_EMAILS", "a@b.c")]).is_err());
    }

    #[test]
    fn develops_without_google() {
        let config = config(&[("PORT", "4000")]).unwrap();
        assert!(config.auth.is_none());
        assert_eq!(config.port, 4000);
        assert_eq!(config.environment, Environment::Development);
    }
}

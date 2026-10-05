//! Hosting of the web app build, with the sign-in redirects of navigations.

use std::path::{Component, Path, PathBuf};

use axum::extract::State;
use axum::http::{HeaderMap, HeaderValue, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};

use crate::http::error;
use crate::state::AppState;

/// Where a navigation must go instead, when authentication is required.
pub fn navigation_redirect(authenticated: bool, pathname: &str) -> Option<&'static str> {
    match (authenticated, pathname == "/sign-in") {
        (false, false) => Some("/sign-in"),
        (true, true) => Some("/"),
        _ => None,
    }
}

/// `relative` resolved inside `root`, or `None` when it would leave it.
fn contained(root: &Path, relative: &str) -> Option<PathBuf> {
    let mut path = root.to_path_buf();
    let mut depth = 0_usize;
    for component in Path::new(relative).components() {
        match component {
            Component::Normal(part) => {
                path.push(part);
                depth += 1;
            }
            Component::CurDir => {}
            Component::ParentDir if depth > 0 => {
                path.pop();
                depth -= 1;
            }
            _ => return None,
        }
    }
    Some(path)
}

async fn is_file(path: &Path) -> bool {
    tokio::fs::metadata(path)
        .await
        .is_ok_and(|metadata| metadata.is_file())
}

pub async fn static_web_app(
    State(state): State<AppState>,
    headers: HeaderMap,
    uri: Uri,
) -> Response {
    let pathname = uri.path();
    // An API path no route answers (such as the retired `/api/v1`) is an API error, never the app.
    if pathname == "/api" || pathname.starts_with("/api/") {
        return error(StatusCode::NOT_FOUND, "not_found");
    }
    let relative = if pathname == "/" {
        "index.html".to_owned()
    } else {
        match percent_encoding::percent_decode_str(&pathname[1..]).decode_utf8() {
            Ok(decoded) => decoded.into_owned(),
            Err(_) => return error(StatusCode::NOT_FOUND, "not_found"),
        }
    };
    let root = std::path::absolute(&state.config.web_dist_path)
        .unwrap_or_else(|_| state.config.web_dist_path.clone());
    let Some(requested) = contained(&root, &relative) else {
        return error(StatusCode::NOT_FOUND, "not_found");
    };
    let asset_exists = is_file(&requested).await;
    let is_navigation = pathname == "/" || !asset_exists;
    if is_navigation && state.config.auth.is_some() {
        let authenticated = state.identity(&headers).await.is_some();
        if let Some(location) = navigation_redirect(authenticated, pathname) {
            return (StatusCode::FOUND, [(header::LOCATION, location)]).into_response();
        }
    }
    let target = if asset_exists {
        requested
    } else {
        root.join("index.html")
    };
    let Ok(bytes) = tokio::fs::read(&target).await else {
        return error(StatusCode::NOT_FOUND, "web_build_not_found");
    };
    let content_type = mime_guess::from_path(&target).first_or_octet_stream();
    let mut response = (
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_str(content_type.essence_str())
                .unwrap_or(HeaderValue::from_static("application/octet-stream")),
        )],
        bytes,
    )
        .into_response();
    if target.file_name().is_some_and(|name| name == "index.html") {
        response
            .headers_mut()
            .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_paths_inside_the_build() {
        let root = Path::new("/srv/web");
        assert_eq!(
            contained(root, "assets/app.js"),
            Some(PathBuf::from("/srv/web/assets/app.js"))
        );
        assert_eq!(
            contained(root, "assets/../sw.js"),
            Some(PathBuf::from("/srv/web/sw.js"))
        );
        assert_eq!(contained(root, "../etc/passwd"), None);
        assert_eq!(contained(root, "/etc/passwd"), None);
    }

    #[test]
    fn redirects_navigations_like_before() {
        assert_eq!(navigation_redirect(false, "/garden"), Some("/sign-in"));
        assert_eq!(navigation_redirect(false, "/sign-in"), None);
        assert_eq!(navigation_redirect(true, "/sign-in"), Some("/"));
        assert_eq!(navigation_redirect(true, "/garden"), None);
    }
}

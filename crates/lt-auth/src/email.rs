/// Trims and lowercases an email; `None` when it does not look like one (as the previous server).
pub fn normalize_email(email: &str) -> Option<String> {
    let normalized = email.trim().to_lowercase();
    if normalized.chars().count() > 254 {
        return None;
    }
    let (local, domain) = normalized.split_once('@')?;
    let valid_part =
        |part: &str| !part.is_empty() && !part.chars().any(|c| c.is_whitespace() || c == '@');
    let (host, top) = domain.rsplit_once('.')?;
    // `^[^\s@]+@[^\s@]+\.[^\s@]+$`: the host may itself contain dots.
    (valid_part(local) && valid_part(host) && valid_part(top)).then_some(normalized)
}

#[cfg(test)]
mod tests {
    use super::normalize_email;

    #[test]
    fn normalises_like_the_previous_server() {
        assert_eq!(
            normalize_email("  Lea@Example.COM "),
            Some("lea@example.com".to_owned())
        );
        assert_eq!(normalize_email("a@b.co.uk"), Some("a@b.co.uk".to_owned()));
        assert_eq!(normalize_email("nope"), None);
        assert_eq!(normalize_email("a@b"), None);
        assert_eq!(normalize_email("a b@c.d"), None);
        assert_eq!(normalize_email("a@@b.c"), None);
        assert_eq!(normalize_email(&format!("{}@b.c", "a".repeat(260))), None);
    }
}

//! Every verb of the Lefff the catalogue offers, for the server's checks of a parent's settings.
//! Left out of the WebAssembly build: the browser loads the same list on demand.

use std::collections::HashSet;
use std::sync::LazyLock;

static INDEX: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    include_str!("../../data/verbs-index.tsv")
        .lines()
        .filter(|line| !line.starts_with('#'))
        .filter_map(|line| line.split('\t').next())
        .filter(|verb| !verb.is_empty())
        .collect()
});

/// Whether the catalogue offers the verb.
pub fn contains(verb: &str) -> bool {
    INDEX.contains(verb)
}

/// How many verbs the catalogue offers.
pub fn len() -> usize {
    INDEX.len()
}

//! Writes `data/verbs-irregular.tsv`: every verb of the Lefff oracle the conjugation rules do not
//! reproduce, with what the engine needs to conjugate it.
//!
//! `pnpm --filter @little-tables/verbs generate`, then
//! `cargo run -p lt-domain --example extract-irregular-verbs`.

use std::fs::File;
use std::io::Read;
use std::path::Path;

use flate2::read::GzDecoder;
use lt_domain::conjugation::rules::{Paradigm, attach, by_rules, format_row, is_first_group};
use lt_domain::conjugation::{FUTURE_ENDINGS, IMPERFECT_ENDINGS};
use serde_json::Value;

type Oracle = Vec<Option<String>>;

fn forms_of(infinitive: &str, paradigm: &Paradigm) -> Oracle {
    let first = is_first_group(infinitive);
    let present = paradigm.present.clone();
    let imperfect: Vec<Option<String>> = (0..6)
        .map(|person| {
            present[person]
                .as_ref()
                .map(|_| attach(&paradigm.imperfect_stem, IMPERFECT_ENDINGS[person], first))
        })
        .collect();
    let future: Vec<Option<String>> = (0..6)
        .map(|person| {
            present[person]
                .as_ref()
                .map(|_| format!("{}{}", paradigm.future_stem, FUTURE_ENDINGS[person]))
        })
        .collect();
    present
        .into_iter()
        .chain(imperfect)
        .chain(future)
        .chain([Some(paradigm.participle.clone())])
        .collect()
}

fn from_oracle(infinitive: &str, forms: &Oracle) -> Option<Paradigm> {
    let person = (0..6).find(|person| forms[*person].is_some())?;
    let present: [Option<String>; 6] = forms[0..6].to_vec().try_into().ok()?;
    let imperfect = forms[6 + person].as_deref()?;
    let future = forms[12 + person].as_deref()?;
    let paradigm = Paradigm {
        present,
        imperfect_stem: imperfect
            .strip_suffix(IMPERFECT_ENDINGS[person])?
            .to_owned(),
        future_stem: future.strip_suffix(FUTURE_ENDINGS[person])?.to_owned(),
        participle: forms[18].clone()?,
    };
    // A first-group stem softened before « a » is written as the oracle writes it.
    let paradigm = if is_first_group(infinitive) && forms_of(infinitive, &paradigm) != *forms {
        let soft = forms[9]
            .as_deref()
            .and_then(|nous| nous.strip_suffix("ons"));
        Paradigm {
            imperfect_stem: soft.unwrap_or(&paradigm.imperfect_stem).to_owned(),
            ..paradigm
        }
    } else {
        paradigm
    };
    (forms_of(infinitive, &paradigm) == *forms).then_some(paradigm)
}

fn main() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let mut json = String::new();
    GzDecoder::new(
        File::open(root.join("tests/fixtures/lefff-forms.json.gz"))
            .expect("run pnpm --filter @little-tables/verbs generate first"),
    )
    .read_to_string(&mut json)
    .expect("gzip JSON");
    let oracle: Value = serde_json::from_str(&json).expect("JSON");
    let notice = oracle["notice"].as_str().unwrap_or_default();
    let verbs = oracle["verbs"].as_object().expect("verbs");
    let mut rows = vec![format!("# {notice}")];
    let mut failures = Vec::new();
    let mut by_rule = 0;
    for (infinitive, forms) in verbs {
        let forms: Oracle = serde_json::from_value(forms.clone()).expect("forms");
        if by_rules(infinitive).is_some_and(|paradigm| forms_of(infinitive, &paradigm) == forms) {
            by_rule += 1;
            continue;
        }
        match from_oracle(infinitive, &forms) {
            Some(paradigm) => rows.push(format_row(infinitive, &paradigm)),
            None => failures.push(infinitive.clone()),
        }
    }
    std::fs::write(
        root.join("data/verbs-irregular.tsv"),
        rows.join("\n") + "\n",
    )
    .expect("write");
    println!("{by_rule} verbs by rule, {} irregular", rows.len() - 1);
    if !failures.is_empty() {
        eprintln!("Not representable: {}", failures.join(", "));
        std::process::exit(1);
    }
}

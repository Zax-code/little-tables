//! The conjugator against the Lefff: every verb, every person, present, imperfect and future, and
//! the past participle, in the traditional spelling. Then the 1990 references the child sees.

use std::fs::File;
use std::io::Read;
use std::path::Path;

use flate2::read::GzDecoder;
use lt_domain::conjugation::{
    accepted_forms, is_accepted, lookup, reference, traditional, verb_table,
};
use lt_domain::model::Tense;
use serde_json::Value;

fn oracle() -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/lefff-forms.json.gz");
    let mut json = String::new();
    GzDecoder::new(File::open(path).expect("the Lefff oracle"))
        .read_to_string(&mut json)
        .expect("gzip JSON");
    serde_json::from_str(&json).expect("JSON")
}

#[test]
fn reproduces_every_lefff_verb() {
    let oracle = oracle();
    let verbs = oracle["verbs"].as_object().expect("verbs");
    assert!(verbs.len() > 7_000);
    let mut failures = Vec::new();
    for (infinitive, forms) in verbs {
        let forms: Vec<Option<String>> = serde_json::from_value(forms.clone()).expect("forms");
        let Some(verb) = lookup(infinitive) else {
            failures.push(format!("{infinitive}: unknown"));
            continue;
        };
        for (offset, tense) in [
            (0, Tense::Present),
            (6, Tense::Imperfect),
            (12, Tense::Future),
        ] {
            for person in 0..6 {
                let actual = traditional(&verb, tense, person);
                if actual != forms[offset + person] {
                    failures.push(format!(
                        "{infinitive} {tense:?} {person}: {actual:?} ≠ {:?}",
                        forms[offset + person]
                    ));
                }
            }
        }
        if Some(&verb.paradigm.participle) != forms[18].as_ref() {
            failures.push(format!(
                "{infinitive}: participle {}",
                verb.paradigm.participle
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "{} differences, first: {:?}",
        failures.len(),
        &failures[..failures.len().min(20)]
    );
}

fn reference_of(verb: &str, tense: Tense, person: usize) -> String {
    reference(&lookup(verb).expect(verb), tense, person).expect("a form")
}

#[test]
fn references_follow_the_1990_spelling() {
    assert_eq!(reference_of("épeler", Tense::Present, 0), "épèle");
    assert_eq!(reference_of("épeler", Tense::Future, 3), "épèlerons");
    assert_eq!(reference_of("appeler", Tense::Present, 0), "appelle");
    assert_eq!(reference_of("jeter", Tense::Present, 5), "jettent");
    assert_eq!(reference_of("feuilleter", Tense::Present, 2), "feuillète");
    assert_eq!(reference_of("espérer", Tense::Future, 0), "espèrerai");
    assert_eq!(reference_of("connaître", Tense::Present, 2), "connait");
    assert_eq!(reference_of("plaire", Tense::Present, 2), "plait");
    assert_eq!(reference_of("croître", Tense::Present, 2), "croît");
    assert_eq!(reference_of("essayer", Tense::Present, 0), "essaie");
    assert_eq!(reference_of("essayer", Tense::Future, 0), "essaierai");
    assert_eq!(reference_of("manger", Tense::Imperfect, 3), "mangions");
    assert_eq!(reference_of("lancer", Tense::Imperfect, 0), "lançais");
    let feuilleter = lookup("feuilleter").expect("feuilleter");
    assert!(is_accepted(&feuilleter, Tense::Present, 2, "feuillette"));
    let essayer = lookup("essayer").expect("essayer");
    assert!(is_accepted(&essayer, Tense::Present, 0, "essaye"));
    assert!(is_accepted(&essayer, Tense::Present, 0, " Essaie "));
    assert!(!is_accepted(&essayer, Tense::Present, 0, "essai"));
}

#[test]
fn the_verbs_a_parent_asked_for() {
    for (verb, person, tense, expected) in [
        ("apercevoir", 5, Tense::Present, "aperçoivent"),
        ("sourire", 3, Tense::Imperfect, "souriions"),
        ("essayer", 2, Tense::Future, "essaiera"),
        ("servir", 2, Tense::Present, "sert"),
        ("comprendre", 5, Tense::Present, "comprennent"),
        ("apprendre", 0, Tense::CompoundPast, "ai appris"),
        ("aller", 3, Tense::CompoundPast, "sommes allés"),
        ("falloir", 2, Tense::Future, "faudra"),
    ] {
        assert_eq!(reference_of(verb, tense, person), expected, "{verb}");
    }
    let aller = lookup("aller").expect("aller");
    assert!(accepted_forms(&aller, Tense::CompoundPast, 4).contains(&"êtes allée".to_owned()));
}

#[test]
fn the_verb_sheet_has_every_tense() {
    let table = verb_table("finir").expect("finir");
    assert_eq!(table.tenses.len(), 4);
    assert!(table.tenses.iter().all(|tense| tense.rows.len() == 6));
    assert_eq!(
        verb_table("pleuvoir").expect("pleuvoir").tenses[0]
            .rows
            .len(),
        1
    );
    assert!(verb_table("blablare").is_none());
    let present = &table.tenses[0].rows[5];
    let text: Vec<&str> = present
        .parts
        .iter()
        .map(|part| part.text.as_str())
        .collect();
    assert_eq!(text, ["fin", "iss", "ent"]);
    assert_eq!(
        verb_table("aimer").expect("aimer").tenses[0].rows[0].subjects,
        ["j’"]
    );
}

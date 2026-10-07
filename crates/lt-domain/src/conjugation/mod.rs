//! French verb conjugation for the CE2 conjugation path (`docs/conjugation/TECHNICAL_SPEC.md`).
//!
//! Forms are built by rules from the infinitive for the first and second groups; the irregular
//! verbs (third group, être, avoir, and the first-group verbs the rules miss) come from
//! `data/verbs-irregular.tsv`. Rules plus data reproduce the Lefff exactly
//! (`tests/conjugation.rs`); that traditional spelling is then rectified as in 1990, which is the
//! reference the child sees, while the traditional form stays accepted.

pub mod exercise;
pub mod rules;

#[cfg(feature = "lexicon")]
pub mod index;

use std::collections::HashMap;
use std::sync::LazyLock;

use serde::{Deserialize, Serialize};

use crate::model::Tense;
pub use rules::Paradigm;

/// Imperfect endings, je to ils.
pub const IMPERFECT_ENDINGS: [&str; 6] = ["ais", "ais", "ait", "ions", "iez", "aient"];
/// Future endings, je to ils.
pub const FUTURE_ENDINGS: [&str; 6] = ["ai", "as", "a", "ons", "ez", "ont"];

/// Verbs conjugated with « être » in the compound past.
const ETRE_VERBS: [&str; 23] = [
    "aller",
    "arriver",
    "décéder",
    "descendre",
    "devenir",
    "entrer",
    "intervenir",
    "monter",
    "mourir",
    "naître",
    "partir",
    "parvenir",
    "redevenir",
    "rentrer",
    "repartir",
    "rester",
    "retomber",
    "retourner",
    "revenir",
    "sortir",
    "survenir",
    "tomber",
    "venir",
];

/// Verbs starting with an aspirated h: no elision (« je hurle »).
const ASPIRATED_H: [&str; 27] = [
    "hacher",
    "haler",
    "haleter",
    "hanter",
    "happer",
    "harasser",
    "harceler",
    "harnacher",
    "harponner",
    "hasarder",
    "hausser",
    "haïr",
    "hennir",
    "heurter",
    "hiberner",
    "hisser",
    "hocher",
    "hongrer",
    "honnir",
    "houspiller",
    "huer",
    "hululer",
    "hurler",
    "hâler",
    "hâter",
    "héler",
    "hérisser",
];

/// Models a verb can be compared with in a hint (« tenir se conjugue comme venir »), longest last.
const MODELS: [&str; 26] = [
    "dire",
    "lire",
    "voir",
    "faire",
    "finir",
    "venir",
    "tenir",
    "mettre",
    "prendre",
    "partir",
    "sortir",
    "dormir",
    "courir",
    "ouvrir",
    "offrir",
    "écrire",
    "rendre",
    "battre",
    "joindre",
    "peindre",
    "craindre",
    "attendre",
    "conduire",
    "paraître",
    "connaître",
    "construire",
];

/// A verb's group, as the catalogue shows it.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum VerbGroup {
    First,
    Second,
    Third,
    Auxiliary,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Auxiliary {
    Avoir,
    Etre,
}

/// A verb the engine can conjugate, in its traditional (Lefff) spelling.
#[derive(Clone, Debug)]
pub struct Verb {
    pub infinitive: String,
    pub group: VerbGroup,
    pub auxiliary: Auxiliary,
    pub paradigm: Paradigm,
}

impl Verb {
    /// Persons the verb has: all six, or « il » alone for weather verbs.
    pub fn persons(&self) -> Vec<usize> {
        (0..6)
            .filter(|person| self.paradigm.present[*person].is_some())
            .collect()
    }

    pub fn impersonal(&self) -> bool {
        self.persons() == vec![2]
    }
}

static IRREGULAR: LazyLock<HashMap<String, Paradigm>> = LazyLock::new(|| {
    include_str!("../../data/verbs-irregular.tsv")
        .lines()
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .filter_map(rules::parse_row)
        .collect()
});

/// The verb, if the engine can conjugate it.
pub fn lookup(infinitive: &str) -> Option<Verb> {
    let paradigm = IRREGULAR
        .get(infinitive)
        .cloned()
        .or_else(|| rules::by_rules(infinitive))?;
    let group = if infinitive == "être" || infinitive == "avoir" {
        VerbGroup::Auxiliary
    } else if rules::is_first_group(infinitive) {
        VerbGroup::First
    } else if infinitive == "haïr" || !IRREGULAR.contains_key(infinitive) {
        VerbGroup::Second
    } else {
        VerbGroup::Third
    };
    let auxiliary = if ETRE_VERBS.contains(&infinitive) {
        Auxiliary::Etre
    } else {
        Auxiliary::Avoir
    };
    Some(Verb {
        infinitive: infinitive.to_owned(),
        group,
        auxiliary,
        paradigm,
    })
}

/* ------------------------------------------------------------------------------------------ */
/* Forms                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/// The traditional form of a simple tense, without the subject.
pub fn simple_form(verb: &Verb, tense: Tense, person: usize) -> Option<String> {
    let paradigm = &verb.paradigm;
    paradigm.present.get(person)?.as_ref()?;
    Some(match tense {
        Tense::Present => paradigm.present[person].clone()?,
        Tense::Imperfect => rules::attach(
            &paradigm.imperfect_stem,
            IMPERFECT_ENDINGS[person],
            verb.group == VerbGroup::First,
        ),
        Tense::Future => format!("{}{}", paradigm.future_stem, FUTURE_ENDINGS[person]),
        Tense::CompoundPast => return None,
    })
}

fn auxiliary_verb(verb: &Verb) -> Verb {
    lookup(match verb.auxiliary {
        Auxiliary::Avoir => "avoir",
        Auxiliary::Etre => "être",
    })
    .expect("être and avoir are in the lexicon")
}

/// The traditional form, the compound past included (auxiliary and masculine participle).
pub fn traditional(verb: &Verb, tense: Tense, person: usize) -> Option<String> {
    if tense != Tense::CompoundPast {
        return simple_form(verb, tense, person);
    }
    verb.paradigm.present.get(person)?.as_ref()?;
    let auxiliary = simple_form(&auxiliary_verb(verb), Tense::Present, person)?;
    let participle = &verb.paradigm.participle;
    let participle = if verb.auxiliary == Auxiliary::Etre && person >= 3 {
        plural(participle)
    } else {
        participle.clone()
    };
    Some(format!("{auxiliary} {participle}"))
}

fn plural(participle: &str) -> String {
    if participle.ends_with('s') {
        participle.to_owned()
    } else {
        format!("{participle}s")
    }
}

fn ends_with_any(word: &str, suffixes: &[&str]) -> bool {
    suffixes.iter().any(|suffix| word.ends_with(suffix))
}

/// The 1990 rectified spelling of a traditional form (the reference shown to the child).
pub fn rectify(verb: &Verb, tense: Tense, person: usize, form: &str) -> String {
    let infinitive = verb.infinitive.as_str();
    let mut form = form.to_owned();
    if verb.group == VerbGroup::First && matches!(tense, Tense::Present | Tense::Future) {
        let stem = &infinitive[..infinitive.len() - 2];
        let mute_person = matches!(person, 0 | 1 | 2 | 5);
        let rewritten = if ends_with_any(infinitive, &["eler", "eter"])
            && !ends_with_any(infinitive, &["appeler", "jeter"])
        {
            rules::grave_on_last_e(stem)
        } else if infinitive.ends_with("ayer") {
            Some(format!("{}i", &stem[..stem.len() - 1]))
        } else if tense == Tense::Future {
            rules::acute_to_grave(stem)
        } else {
            None
        };
        if let Some(mute) = rewritten {
            if tense == Tense::Future {
                form = format!("{mute}er{}", FUTURE_ENDINGS[person]);
            } else if mute_person {
                form = format!("{mute}{}", ["e", "es", "e", "", "", "ent"][person]);
            }
        }
    }
    if infinitive != "croître" {
        form = form.replace('î', "i");
    }
    form
}

/// The form the child is expected to write: rectified spelling, masculine participle.
pub fn reference(verb: &Verb, tense: Tense, person: usize) -> Option<String> {
    if tense == Tense::CompoundPast {
        // The participle keeps its form; only the auxiliary could change, and it never does.
        return traditional(verb, tense, person);
    }
    traditional(verb, tense, person).map(|form| rectify(verb, tense, person, &form))
}

/// Every form counted right: the reference, the traditional spelling, and with « être » the
/// participle agreed in gender and number for je, tu, nous and vous.
pub fn accepted_forms(verb: &Verb, tense: Tense, person: usize) -> Vec<String> {
    let mut forms: Vec<String> = Vec::new();
    let mut push = |form: String| {
        if !forms.contains(&form) {
            forms.push(form);
        }
    };
    let Some(reference) = reference(verb, tense, person) else {
        return Vec::new();
    };
    push(reference);
    if let Some(form) = traditional(verb, tense, person) {
        push(form);
    }
    if tense == Tense::CompoundPast
        && verb.auxiliary == Auxiliary::Etre
        && matches!(person, 0 | 1 | 3 | 4)
        && let Some(auxiliary) = simple_form(&auxiliary_verb(verb), Tense::Present, person)
    {
        let participle = &verb.paradigm.participle;
        let feminine = format!("{participle}e");
        let variants: Vec<String> = match person {
            0 | 1 => vec![feminine],
            3 => vec![format!("{feminine}s")],
            _ => vec![participle.clone(), feminine.clone(), format!("{feminine}s")],
        };
        for variant in variants {
            push(format!("{auxiliary} {variant}"));
        }
    }
    forms
}

/// Lower case, single spaces, straight apostrophes. Accents are kept: they are what is learnt.
pub fn normalize(answer: &str) -> String {
    answer
        .trim()
        .chars()
        .map(french_lowercase)
        .collect::<String>()
        .replace(['’', 'ʼ', '`'], "'")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Lower case for the letters of French, without the Unicode tables (the WebAssembly budget).
fn french_lowercase(letter: char) -> char {
    const UPPER: &str = "ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ";
    const LOWER: &str = "àâäçéèêëîïôöùûüÿœæ";
    if letter.is_ascii_uppercase() {
        return letter.to_ascii_lowercase();
    }
    UPPER
        .chars()
        .position(|upper| upper == letter)
        .and_then(|index| LOWER.chars().nth(index))
        .unwrap_or(letter)
}

/// Whether a written answer is one of the accepted forms.
pub fn is_accepted(verb: &Verb, tense: Tense, person: usize, answer: &str) -> bool {
    let answer = normalize(answer);
    accepted_forms(verb, tense, person)
        .iter()
        .any(|form| normalize(form) == answer)
}

/* ------------------------------------------------------------------------------------------ */
/* Subjects                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/// The subjects a question may show for a person, before elision.
pub fn subjects(verb: &Verb, tense: Tense, person: usize) -> &'static [&'static str] {
    let masculine_only = tense == Tense::CompoundPast && verb.auxiliary == Auxiliary::Etre;
    match person {
        0 => &["je"],
        1 => &["tu"],
        2 if masculine_only || verb.impersonal() => &["il"],
        2 => &["il", "elle"],
        3 => &["nous"],
        4 => &["vous"],
        _ if masculine_only => &["ils"],
        _ => &["ils", "elles"],
    }
}

fn starts_with_vowel(word: &str) -> bool {
    word.chars()
        .next()
        .is_some_and(|first| "aàâäeéèêëiîïoôöuùûüyœæ".contains(first))
}

/// « je » becomes « j’ » before a vowel or a mute h.
pub fn elide(verb: &Verb, subject: &str, form: &str) -> String {
    let mute_h = form.starts_with('h') && !ASPIRATED_H.contains(&verb.infinitive.as_str());
    if subject == "je" && (starts_with_vowel(form) || mute_h) {
        "j’".to_owned()
    } else {
        subject.to_owned()
    }
}

/* ------------------------------------------------------------------------------------------ */
/* Explanations                                                                               */
/* ------------------------------------------------------------------------------------------ */

/// What a part of a written form is, for the colours of hints and of the parent's verb sheet.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PartRole {
    Auxiliary,
    Ending,
    Mark,
    Stem,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct FormPart {
    pub role: PartRole,
    pub text: String,
}

fn part(role: PartRole, text: &str) -> FormPart {
    FormPart {
        role,
        text: text.to_owned(),
    }
}

/// Splits a form into stem, tense mark and person ending (« fin · iss · ent »).
pub fn parts(verb: &Verb, tense: Tense, person: usize, form: &str) -> Vec<FormPart> {
    if tense == Tense::CompoundPast {
        return match form.split_once(' ') {
            Some((auxiliary, participle)) => vec![
                part(PartRole::Auxiliary, auxiliary),
                part(PartRole::Stem, " "),
                part(PartRole::Ending, participle),
            ],
            None => vec![part(PartRole::Stem, form)],
        };
    }
    if verb.group == VerbGroup::Auxiliary && tense == Tense::Present {
        return vec![part(PartRole::Stem, form)];
    }
    let endings: Vec<&str> = match tense {
        Tense::Imperfect => vec![IMPERFECT_ENDINGS[person]],
        Tense::Future => vec![FUTURE_ENDINGS[person]],
        _ => match (verb.group, person) {
            (VerbGroup::Second, 0 | 1) => vec!["is"],
            (VerbGroup::Second, 2) => vec!["it"],
            (_, 0) => vec!["s", "x", "e"],
            (_, 1) => vec!["s", "x", "es"],
            (_, 2) => vec!["t", "d", "e", "a"],
            (_, 3) => vec!["ons", "es"],
            (_, 4) => vec!["ez", "es"],
            _ => vec!["ent", "ont"],
        },
    };
    let Some(ending) = endings
        .into_iter()
        .find(|ending| form.ends_with(ending) && form.len() > ending.len())
    else {
        return vec![part(PartRole::Stem, form)];
    };
    let rest = &form[..form.len() - ending.len()];
    let mark = if verb.group == VerbGroup::Second && rest.ends_with("iss") {
        "iss"
    } else {
        ""
    };
    let stem = &rest[..rest.len() - mark.len()];
    let mut result = vec![part(PartRole::Stem, stem)];
    if !mark.is_empty() {
        result.push(part(PartRole::Mark, mark));
    }
    result.push(part(PartRole::Ending, ending));
    result
}

/// A well-known verb conjugated the same way (« tenir » → « venir »), for hints.
pub fn cousin(verb: &Verb) -> Option<&'static str> {
    if verb.group == VerbGroup::Second && verb.infinitive != "finir" {
        return Some("finir");
    }
    MODELS
        .iter()
        .filter(|model| verb.infinitive != **model && verb.infinitive.ends_with(**model))
        .max_by_key(|model| model.len())
        .copied()
        .or(match verb.infinitive.as_str() {
            "tenir" => Some("venir"),
            "sortir" => Some("partir"),
            _ => None,
        })
}

/// The infinitive as the catalogue writes it: 1990 spelling (« connaitre »).
pub fn display_infinitive(infinitive: &str) -> String {
    if infinitive == "croître" {
        infinitive.to_owned()
    } else {
        infinitive.replace('î', "i")
    }
}

/// One row of the parent's verb sheet.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct VerbRow {
    pub form: String,
    pub parts: Vec<FormPart>,
    pub person: usize,
    pub subjects: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct TenseTable {
    pub rows: Vec<VerbRow>,
    pub tense: Tense,
}

/// A verb, conjugated at the four tenses, for the parent's verb sheet.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerbTable {
    pub auxiliary: Auxiliary,
    pub cousin: Option<String>,
    pub display: String,
    pub group: VerbGroup,
    pub impersonal: bool,
    pub tenses: Vec<TenseTable>,
    pub verb: String,
}

pub fn verb_table(infinitive: &str) -> Option<VerbTable> {
    let verb = lookup(infinitive)?;
    let tenses = Tense::ALL
        .into_iter()
        .map(|tense| TenseTable {
            rows: verb
                .persons()
                .into_iter()
                .filter_map(|person| {
                    let form = reference(&verb, tense, person)?;
                    Some(VerbRow {
                        parts: parts(&verb, tense, person, &form),
                        subjects: subjects(&verb, tense, person)
                            .iter()
                            .map(|subject| elide(&verb, subject, &form))
                            .collect(),
                        form,
                        person,
                    })
                })
                .collect(),
            tense,
        })
        .collect();
    Some(VerbTable {
        auxiliary: verb.auxiliary,
        cousin: cousin(&verb).map(str::to_owned),
        display: display_infinitive(infinitive),
        group: verb.group,
        impersonal: verb.impersonal(),
        tenses,
        verb: infinitive.to_owned(),
    })
}

/// The mastery key of a verb at a tense.
pub fn key(verb: &str, tense: Tense) -> String {
    format!("conj:{verb}:{}", tense.slug())
}

/// The verb and tense of a conjugation key.
pub fn parse_key(key: &str) -> Option<(&str, Tense)> {
    let mut parts = key.split(':');
    let (Some("conj"), Some(verb), Some(tense), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return None;
    };
    let well_formed = !verb.is_empty()
        && verb
            .chars()
            .all(|letter| !letter.is_ascii_uppercase() && !matches!(letter, ':' | ' '));
    well_formed.then_some(())?;
    Some((verb, Tense::from_slug(tense)?))
}

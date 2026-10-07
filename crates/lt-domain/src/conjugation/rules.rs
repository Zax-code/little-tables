//! Conjugation by rules: first group (-er, with its spelling families) and second group (-ir,
//! « finir »), in the traditional spelling of the Lefff. Every other verb is data.

/// What the tenses of a verb are built from.
#[derive(Clone, Debug, PartialEq)]
pub struct Paradigm {
    /// Present, je to ils; `None` for the persons a weather verb does not have.
    pub present: [Option<String>; 6],
    /// Imperfect = this stem + « ais, ais, ait, ions, iez, aient ».
    pub imperfect_stem: String,
    /// Future = this stem + « ai, as, a, ons, ez, ont ».
    pub future_stem: String,
    pub participle: String,
}

const VOWELS: &str = "aàâäeéèêëiîïoôöuùûüyœæ";

fn is_vowel(letter: char) -> bool {
    VOWELS.contains(letter)
}

pub fn is_first_group(infinitive: &str) -> bool {
    infinitive.ends_with("er") && infinitive != "aller" && infinitive.chars().count() > 2
}

/// Imperfect and present endings are attached to a stem; a first-group stem softened for « a »
/// and « o » (« mange- », « lanç- ») loses it before « e » and « i » (« mangions »).
pub fn attach(stem: &str, ending: &str, first_group: bool) -> String {
    let hard = ending.starts_with(['e', 'i']);
    if first_group && hard {
        if let Some(base) = stem.strip_suffix("ge") {
            return format!("{base}g{ending}");
        }
        if let Some(base) = stem.strip_suffix('ç') {
            return format!("{base}c{ending}");
        }
    }
    format!("{stem}{ending}")
}

/// The vowel of the stem's last syllable and the consonants after it, when those consonants are
/// a single sound (« lev », « séch », « lègu », « sevr »).
fn last_syllable(stem: &str) -> Option<(usize, char)> {
    let letters: Vec<char> = stem.chars().collect();
    let mut end = letters.len();
    let mut consonants: Vec<char> = Vec::new();
    while end > 0 {
        let letter = letters[end - 1];
        if letter == 'u' && end >= 2 && matches!(letters[end - 2], 'g' | 'q') {
            consonants.insert(0, 'u');
            consonants.insert(0, letters[end - 2]);
            end -= 2;
            continue;
        }
        if is_vowel(letter) {
            break;
        }
        consonants.insert(0, letter);
        end -= 1;
    }
    if end == 0 {
        return None;
    }
    let single = match consonants.as_slice() {
        [first] => !is_vowel(*first),
        [first, second] => {
            (matches!(second, 'r' | 'l') && !matches!(first, 'r' | 'l'))
                || matches!(
                    (first, second),
                    ('c', 'h') | ('g', 'n') | ('p', 'h') | ('t', 'h') | ('g', 'u') | ('q', 'u')
                )
        }
        _ => false,
    };
    single.then(|| (end - 1, letters[end - 1]))
}

fn replace_at(stem: &str, index: usize, letter: char) -> String {
    stem.chars()
        .enumerate()
        .map(|(position, current)| if position == index { letter } else { current })
        .collect()
}

/// « lev » → « lèv »: a mute e before a single consonant sound takes a grave accent.
pub fn grave_on_last_e(stem: &str) -> Option<String> {
    match last_syllable(stem)? {
        (index, 'e') => Some(replace_at(stem, index, 'è')),
        _ => None,
    }
}

/// « espér » → « espèr ».
pub fn acute_to_grave(stem: &str) -> Option<String> {
    match last_syllable(stem)? {
        (index, 'é') => Some(replace_at(stem, index, 'è')),
        _ => None,
    }
}

fn first_group(infinitive: &str) -> Paradigm {
    let stem = &infinitive[..infinitive.len() - 2];
    let (mute, future_stem) = if infinitive.ends_with("oyer") || infinitive.ends_with("uyer") {
        let mute = format!("{}i", &stem[..stem.len() - 1]);
        let future = format!("{mute}er");
        (mute, future)
    } else if infinitive.ends_with("eler") || infinitive.ends_with("eter") {
        let last = stem.chars().last().unwrap_or_default();
        let mute = format!("{stem}{last}");
        let future = format!("{mute}er");
        (mute, future)
    } else if let Some(mute) = grave_on_last_e(stem) {
        let future = format!("{mute}er");
        (mute, future)
    } else if let Some(mute) = acute_to_grave(stem) {
        (mute, infinitive.to_owned())
    } else {
        (stem.to_owned(), infinitive.to_owned())
    };
    let soft = if infinitive.ends_with("ger") {
        format!("{stem}e")
    } else if infinitive.ends_with("cer") {
        format!("{}ç", &stem[..stem.len() - 1])
    } else {
        stem.to_owned()
    };
    Paradigm {
        present: [
            Some(format!("{mute}e")),
            Some(format!("{mute}es")),
            Some(format!("{mute}e")),
            Some(format!("{soft}ons")),
            Some(format!("{stem}ez")),
            Some(format!("{mute}ent")),
        ],
        imperfect_stem: soft,
        future_stem,
        participle: format!("{stem}é"),
    }
}

fn second_group(infinitive: &str) -> Paradigm {
    let stem = &infinitive[..infinitive.len() - 2];
    Paradigm {
        present: [
            Some(format!("{stem}is")),
            Some(format!("{stem}is")),
            Some(format!("{stem}it")),
            Some(format!("{stem}issons")),
            Some(format!("{stem}issez")),
            Some(format!("{stem}issent")),
        ],
        imperfect_stem: format!("{stem}iss"),
        future_stem: infinitive.to_owned(),
        participle: format!("{stem}i"),
    }
}

/// The paradigm the rules give: first group for -er, second group for -ir; `None` otherwise.
pub fn by_rules(infinitive: &str) -> Option<Paradigm> {
    if is_first_group(infinitive) {
        Some(first_group(infinitive))
    } else if infinitive.ends_with("ir") && infinitive.chars().count() > 2 {
        Some(second_group(infinitive))
    } else {
        None
    }
}

/// One line of `data/verbs-irregular.tsv`:
/// `infinitive \t present (six forms, « - » when missing, separated by |) \t future stem \t
/// participle [\t imperfect stem, when it is not the stem of « nous » in the present]`.
pub fn parse_row(line: &str) -> Option<(String, Paradigm)> {
    let mut columns = line.split('\t');
    let infinitive = columns.next()?.to_owned();
    let present_column = columns.next()?;
    let future_stem = columns.next()?.to_owned();
    let participle = columns.next()?.to_owned();
    let imperfect = columns.next().map(str::to_owned);
    let forms: Vec<Option<String>> = present_column
        .split('|')
        .map(|form| (form != "-").then(|| form.to_owned()))
        .collect();
    let present: [Option<String>; 6] = forms.try_into().ok()?;
    let imperfect_stem = imperfect.or_else(|| {
        present[3]
            .as_deref()
            .and_then(|nous| nous.strip_suffix("ons"))
            .map(str::to_owned)
    })?;
    Some((
        infinitive,
        Paradigm {
            present,
            imperfect_stem,
            future_stem,
            participle,
        },
    ))
}

/// The row `parse_row` reads back.
pub fn format_row(infinitive: &str, paradigm: &Paradigm) -> String {
    let present: Vec<&str> = paradigm
        .present
        .iter()
        .map(|form| form.as_deref().unwrap_or("-"))
        .collect();
    let derived = paradigm.present[3]
        .as_deref()
        .and_then(|nous| nous.strip_suffix("ons"));
    let mut row = format!(
        "{infinitive}\t{}\t{}\t{}",
        present.join("|"),
        paradigm.future_stem,
        paradigm.participle
    );
    if derived != Some(paradigm.imperfect_stem.as_str()) {
        row.push('\t');
        row.push_str(&paradigm.imperfect_stem);
    }
    row
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_group_families() {
        let forms = |verb: &str| by_rules(verb).expect("a first-group verb");
        assert_eq!(forms("manger").present[3].as_deref(), Some("mangeons"));
        assert_eq!(forms("lancer").present[3].as_deref(), Some("lançons"));
        assert_eq!(forms("lever").present[0].as_deref(), Some("lève"));
        assert_eq!(forms("lever").future_stem, "lèver");
        assert_eq!(forms("espérer").present[5].as_deref(), Some("espèrent"));
        assert_eq!(forms("espérer").future_stem, "espérer");
        assert_eq!(forms("appeler").present[0].as_deref(), Some("appelle"));
        assert_eq!(forms("nettoyer").present[0].as_deref(), Some("nettoie"));
        assert_eq!(forms("sécher").present[0].as_deref(), Some("sèche"));
        assert_eq!(forms("protéger").present[0].as_deref(), Some("protège"));
        assert_eq!(forms("protéger").present[3].as_deref(), Some("protégeons"));
        assert_eq!(attach("mange", "ions", true), "mangions");
        assert_eq!(attach("lanç", "ais", true), "lançais");
    }

    #[test]
    fn rows_round_trip() {
        let paradigm = by_rules("finir").expect("finir");
        let row = format_row("finir", &paradigm);
        assert_eq!(parse_row(&row), Some(("finir".to_owned(), paradigm)));
    }
}

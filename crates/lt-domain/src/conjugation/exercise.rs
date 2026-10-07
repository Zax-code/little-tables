//! The « forme qui manque » exercise: four forms to choose from while discovering, letter tiles
//! once the form is familiar. Distractors follow the error families of the Eduscol intervention
//! sheet « Maîtriser l’accord du verbe avec son sujet » (`CE2_CONJUGATION_SPEC.md` §4.3).

use super::{
    VerbGroup, accepted_forms, elide, is_accepted, lookup, normalize, parse_key, reference,
    subjects,
};
use crate::model::{ConjugationExercise, Exercise, PracticeAnswer, SkillId, Tense};
use crate::rng::Rng;

/// Endings swapped for one that sounds the same or close (« finissent » → « finisse »).
const SOUNDS: [(&str, &str); 32] = [
    ("issent", "isent"),
    ("ssent", "sent"),
    ("aient", "ait"),
    ("aient", "ais"),
    ("ent", "e"),
    ("ent", "es"),
    ("ont", "on"),
    ("ions", "iont"),
    ("ons", "on"),
    ("iez", "ier"),
    ("ez", "é"),
    ("ez", "er"),
    ("ais", "ai"),
    ("ais", "é"),
    ("ait", "ais"),
    ("ait", "è"),
    ("ai", "ais"),
    ("ai", "é"),
    ("as", "a"),
    ("a", "as"),
    ("es", "e"),
    ("e", "es"),
    ("é", "er"),
    ("é", "ez"),
    ("is", "it"),
    ("it", "is"),
    ("i", "is"),
    ("u", "us"),
    ("t", "s"),
    ("d", "t"),
    ("x", "s"),
    ("s", "t"),
];

/// Letters added to the tiles when the confusable endings do not give enough.
const FILLERS: &str = "esatinrulo";

fn push_unique(values: &mut Vec<String>, value: String) {
    if !values.contains(&value) {
        values.push(value);
    }
}

/// Forms that sound like the expected one, its last word changed.
fn sound_alikes(form: &str) -> Vec<String> {
    let (head, last) = match form.rsplit_once(' ') {
        Some((head, last)) => (format!("{head} "), last),
        None => (String::new(), form),
    };
    let mut alikes = Vec::new();
    for (suffix, replacement) in SOUNDS {
        if let Some(base) = last.strip_suffix(suffix)
            && !base.is_empty()
        {
            push_unique(&mut alikes, format!("{head}{base}{replacement}"));
        }
    }
    alikes
}

fn distractors(
    verb: &super::Verb,
    tense: Tense,
    person: usize,
    expected: &str,
    random: &mut Rng,
) -> Vec<String> {
    let accepted: Vec<String> = accepted_forms(verb, tense, person)
        .iter()
        .map(|form| normalize(form))
        .collect();
    let mut other_persons: Vec<String> = Vec::new();
    for other in verb.persons().into_iter().filter(|other| *other != person) {
        if let Some(form) = reference(verb, tense, other) {
            push_unique(&mut other_persons, form);
        }
    }
    let mut other_tenses: Vec<String> = Vec::new();
    for other in Tense::ALL.into_iter().filter(|other| *other != tense) {
        if let Some(form) = reference(verb, other, person) {
            push_unique(&mut other_tenses, form);
        }
    }
    let alikes = sound_alikes(expected);
    let mut chosen: Vec<String> = Vec::new();
    let offer = |form: &str, chosen: &mut Vec<String>| {
        if chosen.len() < 3
            && !accepted.contains(&normalize(form))
            && !chosen.iter().any(|c| c == form)
        {
            chosen.push(form.to_owned());
        }
    };
    for family in [&other_persons, &other_tenses, &alikes] {
        let usable: Vec<&String> = family
            .iter()
            .filter(|form| !accepted.contains(&normalize(form)))
            .collect();
        if !usable.is_empty() {
            offer(usable[random.index(usable.len())], &mut chosen);
        }
    }
    if verb.group == VerbGroup::Second && tense == Tense::Present {
        let stem = &verb.infinitive[..verb.infinitive.len() - 2];
        let ending = ["ie", "ies", "ie", "ons", "ez", "ient"][person];
        offer(&format!("{stem}{ending}"), &mut chosen);
    }
    for form in other_persons.iter().chain(&alikes).chain(&other_tenses) {
        offer(form, &mut chosen);
    }
    for extra in ["s", "t", "e", "es"] {
        offer(&format!("{expected}{extra}"), &mut chosen);
    }
    chosen.truncate(3);
    chosen
}

/// The letters of the form, plus confusable letters, shuffled.
fn letter_bank(expected: &str, random: &mut Rng) -> Vec<String> {
    let mut letters: Vec<char> = expected.chars().collect();
    let size = ((letters.len() + 3).div_ceil(6) * 6).max(12);
    let mut spare: Vec<char> = letters.clone();
    let mut extras: Vec<char> = Vec::new();
    for alike in sound_alikes(expected) {
        for letter in alike.chars() {
            if let Some(index) = spare.iter().position(|current| *current == letter) {
                spare.remove(index);
            } else if !extras.contains(&letter) && letter != ' ' {
                extras.push(letter);
            }
        }
        spare = letters.clone();
    }
    for letter in FILLERS.chars() {
        if !extras.contains(&letter) && !letters.contains(&letter) {
            extras.push(letter);
        }
    }
    for letter in FILLERS.chars() {
        extras.push(letter);
    }
    letters.extend(extras.into_iter().take(size - letters.len()));
    random
        .shuffle(&letters)
        .into_iter()
        .map(String::from)
        .collect()
}

/// Builds one question on a conjugation key (`conj:finir:present`).
pub fn generate(key: &str, random: &mut Rng, recall: bool) -> Option<Exercise> {
    let (infinitive, tense) = parse_key(key)?;
    let verb = lookup(infinitive)?;
    let persons = verb.persons();
    let person = persons[random.index(persons.len())];
    let options = subjects(&verb, tense, person);
    let subject = if options.len() > 1 {
        options[random.index(options.len())]
    } else {
        options[0]
    };
    let expected = reference(&verb, tense, person)?;
    let (choices, letters) = if recall {
        (Vec::new(), letter_bank(&expected, random))
    } else {
        let mut tiles = vec![expected.clone()];
        tiles.extend(distractors(&verb, tense, person, &expected, random));
        let choices = random
            .shuffle(&tiles)
            .into_iter()
            .map(|value| PracticeAnswer::Text { value })
            .collect();
        (choices, Vec::new())
    };
    Some(Exercise::Conjugation(ConjugationExercise {
        choices,
        subject: elide(&verb, subject, &expected),
        expected,
        letters,
        person: person as i64,
        skill: SkillId::Conjugation,
        tense,
        verb: infinitive.to_owned(),
    }))
}

/// The exercise names a known verb, a person it has, a matching subject, the reference form, and
/// tiles or letters that let the child write it.
pub fn is_well_formed(exercise: &ConjugationExercise) -> bool {
    let Some(verb) = lookup(&exercise.verb) else {
        return false;
    };
    let Ok(person) = usize::try_from(exercise.person) else {
        return false;
    };
    if exercise.skill != SkillId::Conjugation || !verb.persons().contains(&person) {
        return false;
    }
    if reference(&verb, exercise.tense, person).as_deref() != Some(exercise.expected.as_str()) {
        return false;
    }
    let subject_matches = subjects(&verb, exercise.tense, person)
        .iter()
        .any(|subject| elide(&verb, subject, &exercise.expected) == exercise.subject);
    if !subject_matches {
        return false;
    }
    if exercise.choices.is_empty() {
        let mut spare: Vec<&str> = exercise.letters.iter().map(String::as_str).collect();
        let fits = exercise.expected.chars().all(|letter| {
            let wanted = letter.to_string();
            match spare.iter().position(|current| *current == wanted) {
                Some(index) => {
                    spare.remove(index);
                    true
                }
                None => false,
            }
        });
        fits && exercise.letters.len() <= 30
            && exercise
                .letters
                .iter()
                .all(|letter| letter.chars().count() == 1)
    } else {
        let values: Vec<&str> = exercise
            .choices
            .iter()
            .filter_map(|choice| match choice {
                PracticeAnswer::Text { value } => Some(value.as_str()),
                _ => None,
            })
            .collect();
        let distinct = values
            .iter()
            .enumerate()
            .all(|(index, value)| !values[..index].contains(value));
        exercise.letters.is_empty()
            && values.len() == 4
            && exercise.choices.len() == 4
            && distinct
            && values.contains(&exercise.expected.as_str())
    }
}

pub fn is_correct(exercise: &ConjugationExercise, answer: &PracticeAnswer) -> bool {
    let (PracticeAnswer::Text { value }, Some(verb), Ok(person)) = (
        answer,
        lookup(&exercise.verb),
        usize::try_from(exercise.person),
    ) else {
        return false;
    };
    is_accepted(&verb, exercise.tense, person, value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn exercise(key: &str, seed: u32, recall: bool) -> ConjugationExercise {
        match generate(key, &mut Rng::new(seed), recall) {
            Some(Exercise::Conjugation(exercise)) => exercise,
            other => panic!("no exercise for {key}: {other:?}"),
        }
    }

    #[test]
    fn discovery_offers_four_distinct_forms_with_the_answer() {
        for seed in 0..200 {
            for key in [
                "conj:finir:present",
                "conj:aller:future",
                "conj:essayer:present",
            ] {
                let exercise = exercise(key, seed, false);
                assert!(is_well_formed(&exercise), "{exercise:?}");
                let answer = PracticeAnswer::Text {
                    value: exercise.expected.clone(),
                };
                assert!(is_correct(&exercise, &answer));
                let wrong = exercise
                    .choices
                    .iter()
                    .filter(|choice| !is_correct(&exercise, choice))
                    .count();
                assert_eq!(wrong, 3, "{exercise:?}");
            }
        }
    }

    #[test]
    fn recall_tiles_spell_the_answer() {
        for seed in 0..200 {
            let exercise = exercise("conj:venir:compound-past", seed, true);
            assert!(is_well_formed(&exercise), "{exercise:?}");
            assert!(exercise.choices.is_empty());
            assert_eq!(exercise.letters.len() % 6, 0);
        }
    }

    #[test]
    fn subjects_are_elided_and_agreement_is_accepted() {
        let verb = lookup("aimer").expect("aimer");
        assert_eq!(elide(&verb, "je", "aime"), "j’");
        let hurler = lookup("hurler").expect("hurler");
        assert_eq!(elide(&hurler, "je", "hurle"), "je");
        let aller = lookup("aller").expect("aller");
        assert!(is_accepted(&aller, Tense::CompoundPast, 0, "suis allée"));
        assert!(is_accepted(&aller, Tense::CompoundPast, 3, "sommes allés"));
        assert!(!is_accepted(&aller, Tense::CompoundPast, 2, "est allés"));
    }
}

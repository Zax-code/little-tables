//! Exercise answers and checks: what the expected answer is, whether an answer is right, whether
//! the learner produced it, and whether an exercise is well formed.

use crate::model::{
    ArithmeticBlank, ArithmeticExercise, ArithmeticOperation, ColumnExercise, ColumnOperation,
    ComparisonSymbol, EqualBlank, Exercise, Fraction, FractionLineExercise,
    FractionOperationExercise, FractionPickExercise, LineMode, PracticeAnswer, ReadMode, SkillId,
};

/// The CE2 number field: every number and every result stays at or below 10 000.
pub const MAX_WHOLE_NUMBER: i64 = 10_000;
pub const MAX_DENOMINATOR: i64 = 12;

/// The skill a level key belongs to.
pub fn skill_for_key(key: &str) -> Option<SkillId> {
    let parts: Vec<&str> = key.split(':').collect();
    let digits = |value: &str| !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit());
    let slug = |value: &str| {
        !value.is_empty()
            && value
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    };
    let letters_dash = |value: &str| {
        !value.is_empty()
            && value
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte == b'-')
    };
    let alphanumeric = |value: &str| {
        !value.is_empty()
            && value
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    };
    match parts.as_slice() {
        ["add", left, right] if digits(left) && digits(right) => Some(SkillId::AdditionFacts),
        ["sub", left, right] if digits(left) && digits(right) => Some(SkillId::SubtractionFacts),
        ["numeration", level] if slug(level) => Some(SkillId::Numeration),
        ["nearten", operation, amount] if matches!(*operation, "add" | "sub") && digits(amount) => {
            Some(SkillId::NearTen)
        }
        ["column", "add", level] if slug(level) => Some(SkillId::ColumnAddition),
        ["column", "add", level, extra] if slug(level) && slug(extra) => {
            Some(SkillId::ColumnAddition)
        }
        ["column", "sub", level] if slug(level) => Some(SkillId::ColumnSubtraction),
        ["column", "sub", level, extra] if slug(level) && slug(extra) => {
            Some(SkillId::ColumnSubtraction)
        }
        ["frac", "read", denominator] if digits(denominator) => Some(SkillId::FractionRead),
        ["frac", "equal", pair] => {
            let mut sides = pair.splitn(2, '-');
            match (sides.next(), sides.next()) {
                (Some(small), Some(large)) if digits(small) && digits(large) => {
                    Some(SkillId::FractionEqual)
                }
                _ => None,
            }
        }
        ["frac", "line", level] if alphanumeric(level) => Some(SkillId::FractionLine),
        ["frac", "compare", level] if letters_dash(level) => Some(SkillId::FractionCompare),
        ["frac", "add" | "sub" | "complement"] => Some(SkillId::FractionOperation),
        ["frac", "add" | "sub" | "complement", level] if letters_dash(level) => {
            Some(SkillId::FractionOperation)
        }
        _ => None,
    }
}

/// A fraction-like value: a numerator over a denominator plus whole units.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Ratio {
    pub denominator: i64,
    pub numerator: i64,
    pub whole: i64,
}

impl From<Fraction> for Ratio {
    fn from(value: Fraction) -> Self {
        Self {
            denominator: value.denominator,
            numerator: value.numerator,
            whole: 0,
        }
    }
}

/// Numerator over a shared denominator, so equal values compare exactly without floats.
fn scaled(value: Ratio, denominator: i64) -> i64 {
    (value.whole * value.denominator + value.numerator) * (denominator / value.denominator)
}

pub(crate) fn same_value(first: Ratio, second: Ratio) -> bool {
    let common = first.denominator * second.denominator;
    common != 0 && scaled(first, common) == scaled(second, common)
}

pub fn compare_fractions(first: Fraction, second: Fraction) -> ComparisonSymbol {
    let common = first.denominator * second.denominator;
    let difference = scaled(first.into(), common) - scaled(second.into(), common);
    match difference.signum() {
        0 => ComparisonSymbol::Equal,
        -1 => ComparisonSymbol::Less,
        _ => ComparisonSymbol::Greater,
    }
}

pub fn fraction_operation_result(exercise: &FractionOperationExercise) -> Fraction {
    let denominator = exercise.left.denominator.max(exercise.right.denominator);
    let left = scaled(exercise.left.into(), denominator);
    let right = scaled(exercise.right.into(), denominator);
    Fraction {
        denominator,
        numerator: match exercise.operation {
            ColumnOperation::Add => left + right,
            ColumnOperation::Subtract => left - right,
        },
    }
}

/// The result as a real number: halving an odd number is not a whole number.
fn arithmetic_result(exercise: &ArithmeticExercise) -> f64 {
    let (left, right) = (exercise.left as f64, exercise.right as f64);
    match exercise.operation {
        ArithmeticOperation::Add => left + right,
        ArithmeticOperation::Subtract => left - right,
        ArithmeticOperation::Double => left * 2.0,
        ArithmeticOperation::Half => left / 2.0,
    }
}

pub fn column_result(exercise: &ColumnExercise) -> i64 {
    match exercise.operation {
        ColumnOperation::Add => exercise.terms.iter().sum(),
        ColumnOperation::Subtract => {
            exercise.terms.first().copied().unwrap_or(0)
                - exercise.terms.get(1).copied().unwrap_or(0)
        }
    }
}

/// The graduation the target sits on, counted from zero in steps of one tick.
pub fn line_tick_index(exercise: &FractionLineExercise) -> i64 {
    let target = exercise.target;
    ((target.whole * target.denominator + target.numerator) * exercise.ticks) / target.denominator
}

pub fn equal_option_indexes(exercise: &FractionPickExercise) -> Vec<i64> {
    exercise
        .options
        .iter()
        .enumerate()
        .filter(|(_, option)| same_value((**option).into(), exercise.reference.into()))
        .map(|(index, _)| index as i64)
        .collect()
}

/// The canonical answer shown after a question, in the form the exercise was written in.
pub fn expected_answer(exercise: &Exercise) -> PracticeAnswer {
    match exercise {
        Exercise::Arithmetic(exercise) => PracticeAnswer::Integer {
            value: match exercise.blank {
                ArithmeticBlank::Result => arithmetic_result(exercise) as i64,
                ArithmeticBlank::Left => exercise.left,
                ArithmeticBlank::Right => exercise.right,
            },
        },
        Exercise::Column(exercise) => PracticeAnswer::Integer {
            value: column_result(exercise),
        },
        Exercise::FractionRead(exercise) => match exercise.mode {
            ReadMode::Read => PracticeAnswer::Fraction {
                denominator: exercise.fraction.denominator,
                numerator: exercise.fraction.numerator,
                whole: 0,
            },
            ReadMode::Build => PracticeAnswer::Selection {
                ids: (0..exercise.fraction.numerator).collect(),
            },
        },
        Exercise::FractionEqual(exercise) => PracticeAnswer::Integer {
            value: match exercise.blank {
                EqualBlank::Numerator => exercise.target.numerator,
                EqualBlank::Denominator => exercise.target.denominator,
            },
        },
        Exercise::FractionPick(exercise) => PracticeAnswer::Selection {
            ids: equal_option_indexes(exercise),
        },
        Exercise::FractionLine(exercise) => match exercise.mode {
            LineMode::Read => PracticeAnswer::Fraction {
                denominator: exercise.target.denominator,
                numerator: exercise.target.numerator,
                whole: exercise.target.whole,
            },
            LineMode::Place => PracticeAnswer::Tick {
                index: line_tick_index(exercise),
            },
        },
        Exercise::FractionCompare(exercise) => PracticeAnswer::Comparison {
            symbol: compare_fractions(exercise.left, exercise.right),
        },
        Exercise::FractionOperation(exercise) => {
            let result = fraction_operation_result(exercise);
            PracticeAnswer::Fraction {
                denominator: result.denominator,
                numerator: result.numerator,
                whole: 0,
            }
        }
    }
}

fn distinct_ids(ids: &[i64]) -> bool {
    let mut sorted = ids.to_vec();
    sorted.sort_unstable();
    sorted.windows(2).all(|pair| pair[0] != pair[1])
}

pub fn is_exercise_answer_correct(exercise: &Exercise, answer: &PracticeAnswer) -> bool {
    if let Exercise::FractionRead(read) = exercise
        && read.mode == ReadMode::Build
    {
        return match answer {
            PracticeAnswer::Selection { ids } => {
                distinct_ids(ids)
                    && ids.iter().all(|id| *id < read.fraction.denominator)
                    && ids.len() as i64 == read.fraction.numerator
            }
            _ => false,
        };
    }
    match (expected_answer(exercise), answer) {
        (PracticeAnswer::Integer { value: expected }, PracticeAnswer::Integer { value }) => {
            *value == expected
        }
        (
            PracticeAnswer::Fraction {
                denominator,
                numerator,
                whole,
            },
            PracticeAnswer::Fraction {
                denominator: answer_denominator,
                numerator: answer_numerator,
                whole: answer_whole,
            },
        ) => {
            // Any equivalent fraction is right: the programme never asks CE2 learners to simplify.
            same_value(
                Ratio {
                    denominator: *answer_denominator,
                    numerator: *answer_numerator,
                    whole: *answer_whole,
                },
                Ratio {
                    denominator,
                    numerator,
                    whole,
                },
            )
        }
        (
            PracticeAnswer::Comparison { symbol: expected },
            PracticeAnswer::Comparison { symbol },
        ) => *symbol == expected,
        (PracticeAnswer::Tick { index: expected }, PracticeAnswer::Tick { index }) => {
            *index == expected
        }
        (PracticeAnswer::Selection { ids: expected }, PracticeAnswer::Selection { ids }) => {
            distinct_ids(ids)
                && ids.len() == expected.len()
                && expected.iter().all(|id| ids.contains(id))
        }
        _ => false,
    }
}

/// True when the learner produced the answer rather than recognising it among tiles.
pub fn is_production_exercise(exercise: &Exercise) -> bool {
    match exercise {
        Exercise::Column(_) | Exercise::FractionPick(_) => true,
        Exercise::FractionRead(read) => read.mode == ReadMode::Build || read.choices.is_empty(),
        Exercise::FractionLine(line) => line.mode == LineMode::Place || line.choices.is_empty(),
        Exercise::FractionCompare(_) => false,
        Exercise::Arithmetic(arithmetic) => arithmetic.choices.is_empty(),
        Exercise::FractionEqual(equal) => equal.choices.is_empty(),
        Exercise::FractionOperation(operation) => operation.choices.is_empty(),
    }
}

fn is_fraction(fraction: Fraction) -> bool {
    (1..=MAX_DENOMINATOR).contains(&fraction.denominator)
        && fraction.numerator >= 0
        && fraction.numerator <= fraction.denominator
}

fn denominators_compatible(first: Fraction, second: Fraction) -> bool {
    first.denominator % second.denominator == 0 || second.denominator % first.denominator == 0
}

fn arithmetic_well_formed(exercise: &ArithmeticExercise) -> bool {
    let ArithmeticExercise {
        left,
        operation,
        right,
        skill,
        ..
    } = *exercise;
    if matches!(
        operation,
        ArithmeticOperation::Double | ArithmeticOperation::Half
    ) && exercise.blank != ArithmeticBlank::Result
    {
        return false;
    }
    if operation == ArithmeticOperation::Half && left % 2 != 0 {
        return false;
    }
    if operation == ArithmeticOperation::Subtract && right > left {
        return false;
    }
    let result = arithmetic_result(exercise);
    if result.fract() != 0.0 || result < 0.0 || result > MAX_WHOLE_NUMBER as f64 {
        return false;
    }
    match skill {
        SkillId::AdditionFacts => {
            operation == ArithmeticOperation::Add
                && (1..=10).contains(&left)
                && (1..=10).contains(&right)
        }
        SkillId::SubtractionFacts => {
            operation == ArithmeticOperation::Subtract
                && left <= 20
                && (1..=10).contains(&right)
                && result <= 10.0
        }
        SkillId::NearTen => {
            matches!(
                operation,
                ArithmeticOperation::Add | ArithmeticOperation::Subtract
            ) && matches!(right % 10, 8 | 9)
        }
        SkillId::Numeration => true,
        _ => false,
    }
}

/// Each exercise kind belongs to fixed skills; the previous server enforced this while decoding.
fn kind_matches_skill(exercise: &Exercise) -> bool {
    match exercise {
        Exercise::Arithmetic(arithmetic) => matches!(
            arithmetic.skill,
            SkillId::AdditionFacts
                | SkillId::SubtractionFacts
                | SkillId::Numeration
                | SkillId::NearTen
        ),
        Exercise::Column(column) => {
            matches!(
                column.skill,
                SkillId::ColumnAddition | SkillId::ColumnSubtraction
            )
        }
        Exercise::FractionRead(read) => read.skill == SkillId::FractionRead,
        Exercise::FractionEqual(equal) => equal.skill == SkillId::FractionEqual,
        Exercise::FractionPick(pick) => pick.skill == SkillId::FractionEqual,
        Exercise::FractionLine(line) => line.skill == SkillId::FractionLine,
        Exercise::FractionCompare(compare) => compare.skill == SkillId::FractionCompare,
        Exercise::FractionOperation(operation) => operation.skill == SkillId::FractionOperation,
    }
}

pub fn is_exercise_well_formed(exercise: &Exercise) -> bool {
    if !kind_matches_skill(exercise) {
        return false;
    }
    match exercise {
        Exercise::Arithmetic(arithmetic) => arithmetic_well_formed(arithmetic),
        Exercise::Column(column) => {
            if !(2..=3).contains(&column.terms.len())
                || column
                    .terms
                    .iter()
                    .any(|term| !(1..=MAX_WHOLE_NUMBER).contains(term))
            {
                return false;
            }
            let result = column_result(column);
            match column.skill {
                SkillId::ColumnAddition => {
                    column.operation == ColumnOperation::Add && result <= MAX_WHOLE_NUMBER
                }
                SkillId::ColumnSubtraction => {
                    column.operation == ColumnOperation::Subtract
                        && column.terms.len() == 2
                        && result >= 0
                }
                _ => false,
            }
        }
        Exercise::FractionRead(read) => is_fraction(read.fraction) && read.fraction.numerator >= 1,
        Exercise::FractionEqual(equal) => {
            is_fraction(equal.known)
                && is_fraction(equal.target)
                && equal.known.denominator != equal.target.denominator
                && denominators_compatible(equal.known, equal.target)
                && same_value(equal.known.into(), equal.target.into())
        }
        Exercise::FractionPick(pick) => {
            is_fraction(pick.reference)
                && pick.options.iter().all(|option| is_fraction(*option))
                && !equal_option_indexes(pick).is_empty()
        }
        Exercise::FractionLine(line) => {
            let target = line.target;
            if !(1..=MAX_DENOMINATOR).contains(&target.denominator)
                || !(1..=MAX_DENOMINATOR).contains(&line.ticks)
                || !matches!(line.units, 1 | 2)
            {
                return false;
            }
            let position =
                target.whole as f64 + target.numerator as f64 / target.denominator as f64;
            target.numerator <= target.denominator
                && position > 0.0
                && position <= line.units as f64
                && ((target.whole * target.denominator + target.numerator) * line.ticks)
                    % target.denominator
                    == 0
        }
        Exercise::FractionCompare(compare) => {
            is_fraction(compare.left)
                && is_fraction(compare.right)
                && (compare.left.denominator == compare.right.denominator
                    || compare.left.numerator == compare.right.numerator
                    || denominators_compatible(compare.left, compare.right))
        }
        Exercise::FractionOperation(operation) => {
            if !is_fraction(operation.left) || !is_fraction(operation.right) {
                return false;
            }
            if !denominators_compatible(operation.left, operation.right) {
                return false;
            }
            let result = fraction_operation_result(operation);
            result.numerator >= 0 && result.numerator <= result.denominator
        }
    }
}

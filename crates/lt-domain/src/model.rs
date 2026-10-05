//! Serialisable values shared with the TypeScript client. Field names and tags follow the JSON the
//! client already stores, so events written by the previous engine decode unchanged. Instants are
//! Unix milliseconds.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

/// Unix time in milliseconds.
pub type Millis = i64;

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PathId {
    Additions,
    BigNumbers,
    Fractions,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SkillId {
    AdditionFacts,
    SubtractionFacts,
    Numeration,
    NearTen,
    ColumnAddition,
    ColumnSubtraction,
    FractionRead,
    FractionEqual,
    FractionLine,
    FractionCompare,
    FractionOperation,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PathMode {
    Automatic,
    Manual,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SubtractionMethod {
    Compensation,
    Decomposition,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningPathSettings {
    pub enabled_skills: Vec<SkillId>,
    pub focus_skill: Option<SkillId>,
    pub mode: PathMode,
    pub subtraction_method: SubtractionMethod,
}

impl Default for LearningPathSettings {
    fn default() -> Self {
        Self {
            enabled_skills: Vec::new(),
            focus_skill: None,
            mode: PathMode::Automatic,
            subtraction_method: SubtractionMethod::Compensation,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct Fraction {
    pub denominator: i64,
    pub numerator: i64,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct MixedFraction {
    pub denominator: i64,
    pub numerator: i64,
    pub whole: i64,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum ComparisonSymbol {
    #[serde(rename = "<")]
    Less,
    #[serde(rename = "=")]
    Equal,
    #[serde(rename = ">")]
    Greater,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum PracticeAnswer {
    Integer {
        value: i64,
    },
    Fraction {
        denominator: i64,
        numerator: i64,
        whole: i64,
    },
    Comparison {
        symbol: ComparisonSymbol,
    },
    Tick {
        index: i64,
    },
    Selection {
        ids: Vec<i64>,
    },
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArithmeticBlank {
    Result,
    Left,
    Right,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArithmeticOperation {
    Add,
    Subtract,
    Double,
    Half,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ColumnOperation {
    Add,
    Subtract,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReadMode {
    Read,
    Build,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReadShape {
    Bed,
    Pot,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum EqualBlank {
    Numerator,
    Denominator,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LineMode {
    Place,
    Read,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArithmeticExercise {
    pub blank: ArithmeticBlank,
    pub choices: Vec<PracticeAnswer>,
    pub left: i64,
    pub operation: ArithmeticOperation,
    pub result_first: bool,
    pub right: i64,
    pub skill: SkillId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ColumnExercise {
    pub operation: ColumnOperation,
    pub skill: SkillId,
    pub terms: Vec<i64>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct FractionReadExercise {
    pub choices: Vec<PracticeAnswer>,
    pub fraction: Fraction,
    pub mode: ReadMode,
    pub shape: ReadShape,
    pub skill: SkillId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct FractionEqualExercise {
    pub blank: EqualBlank,
    pub choices: Vec<PracticeAnswer>,
    pub known: Fraction,
    pub skill: SkillId,
    pub target: Fraction,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct FractionPickExercise {
    pub options: Vec<Fraction>,
    pub reference: Fraction,
    pub skill: SkillId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct FractionLineExercise {
    pub choices: Vec<PracticeAnswer>,
    pub mode: LineMode,
    pub skill: SkillId,
    pub target: MixedFraction,
    pub ticks: i64,
    pub units: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct FractionCompareExercise {
    pub left: Fraction,
    pub right: Fraction,
    pub skill: SkillId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct FractionOperationExercise {
    pub choices: Vec<PracticeAnswer>,
    pub left: Fraction,
    pub operation: ColumnOperation,
    pub right: Fraction,
    pub skill: SkillId,
    pub story: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Exercise {
    Arithmetic(ArithmeticExercise),
    Column(ColumnExercise),
    FractionRead(FractionReadExercise),
    FractionEqual(FractionEqualExercise),
    FractionPick(FractionPickExercise),
    FractionLine(FractionLineExercise),
    FractionCompare(FractionCompareExercise),
    FractionOperation(FractionOperationExercise),
}

impl Exercise {
    pub fn skill(&self) -> SkillId {
        match self {
            Self::Arithmetic(exercise) => exercise.skill,
            Self::Column(exercise) => exercise.skill,
            Self::FractionRead(exercise) => exercise.skill,
            Self::FractionEqual(exercise) => exercise.skill,
            Self::FractionPick(exercise) => exercise.skill,
            Self::FractionLine(exercise) => exercise.skill,
            Self::FractionCompare(exercise) => exercise.skill,
            Self::FractionOperation(exercise) => exercise.skill,
        }
    }

    /// Tile choices, for the exercise kinds that carry them.
    pub fn choices(&self) -> Option<&[PracticeAnswer]> {
        match self {
            Self::Arithmetic(exercise) => Some(&exercise.choices),
            Self::FractionRead(exercise) => Some(&exercise.choices),
            Self::FractionEqual(exercise) => Some(&exercise.choices),
            Self::FractionLine(exercise) => Some(&exercise.choices),
            Self::FractionOperation(exercise) => Some(&exercise.choices),
            Self::Column(_) | Self::FractionPick(_) | Self::FractionCompare(_) => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MasteryState {
    Unseen,
    Learning,
    Familiar,
    Fluent,
}

impl MasteryState {
    pub fn is_stable(self) -> bool {
        matches!(self, Self::Familiar | Self::Fluent)
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FactMastery {
    pub correct_count: i64,
    pub correct_streak: i64,
    pub difficulty: f64,
    pub due_at: Option<Millis>,
    pub last_reviewed_at: Option<Millis>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_reviewed_day_key: Option<String>,
    pub lapse_count: i64,
    pub latency_ms: Option<f64>,
    pub recall_day_keys: Vec<String>,
    pub successful_day_keys: Vec<String>,
    pub stability_days: f64,
    pub state: MasteryState,
}

impl FactMastery {
    pub fn empty() -> Self {
        Self {
            correct_count: 0,
            correct_streak: 0,
            difficulty: 0.5,
            due_at: None,
            last_reviewed_at: None,
            last_reviewed_day_key: None,
            lapse_count: 0,
            latency_ms: None,
            recall_day_keys: Vec::new(),
            successful_day_keys: Vec::new(),
            stability_days: 0.0,
            state: MasteryState::Unseen,
        }
    }
}

/// Mastery per fact key, in first-seen order. The order is part of the contract: it is the order
/// the previous engine produced and kept.
pub type Facts = IndexMap<String, FactMastery>;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningSnapshot {
    pub algorithm_version: String,
    pub facts: Facts,
    pub processed_event_ids: Vec<String>,
}

impl Default for LearningSnapshot {
    fn default() -> Self {
        Self {
            algorithm_version: "1".to_owned(),
            facts: Facts::new(),
            processed_event_ids: Vec::new(),
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AnswerMode {
    Choice,
    Keypad,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum QuestionOperation {
    Divide,
    #[default]
    Multiply,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeQuestion {
    pub answer_mode: AnswerMode,
    pub choices: Vec<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exercise: Option<Exercise>,
    pub fact_key: String,
    pub id: String,
    pub left: i64,
    pub operation: QuestionOperation,
    pub right: i64,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SessionKind {
    DailyWatering,
    ExtraPractice,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeSession {
    pub created_at: Millis,
    pub current_question_started_at: Millis,
    pub current_index: i64,
    pub id: String,
    pub kind: SessionKind,
    pub questions: Vec<PracticeQuestion>,
    pub seed: u32,
    pub time_zone: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttemptEvent {
    pub answer_mode: AnswerMode,
    pub answered_at: Millis,
    pub choices: Vec<i64>,
    pub correct: bool,
    pub event_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exercise: Option<Exercise>,
    pub fact_key: String,
    pub latency_ms: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub learning_day_key: Option<String>,
    pub left: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operation: Option<QuestionOperation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response: Option<PracticeAnswer>,
    pub right: i64,
    pub question_count: i64,
    pub selected: i64,
    pub sequence: i64,
    pub session_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_kind: Option<SessionKind>,
    /// Engine version that produced the event. Absent on events written before the rewrite.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub algorithm_version: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CurriculumPack {
    Core,
    #[serde(rename = "bonus-11-12")]
    Bonus1112,
    InverseDivision,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurriculumPolicy {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub packs: Option<Vec<CurriculumPack>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paths: Option<LearningPathSettings>,
}

/// How a session is composed. A daily watering carries only a curriculum; extra practice names a
/// question count and optionally a table or skill to focus on.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticePolicy {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub curriculum: Option<CurriculumPolicy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_skill: Option<SkillId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_table: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<SessionKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub question_count: Option<i64>,
}

impl PracticePolicy {
    pub fn is_daily(&self) -> bool {
        self.kind == Some(SessionKind::DailyWatering)
    }
}

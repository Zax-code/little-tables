/**
 * Schemas of the values the Rust learning engine reads and writes. They mirror the serde types of
 * `crates/lt-domain`; instants are Unix milliseconds.
 */
import { Schema } from 'effect'

export const Millis = Schema.Int
const Int = Schema.Int
const DayKey = Schema.String

export const PathId = Schema.Literals(['additions', 'big-numbers', 'fractions', 'conjugation'])
export type PathId = typeof PathId.Type

export const SkillId = Schema.Literals([
  'addition-facts',
  'subtraction-facts',
  'numeration',
  'near-ten',
  'column-addition',
  'column-subtraction',
  'fraction-read',
  'fraction-equal',
  'fraction-line',
  'fraction-compare',
  'fraction-operation',
  'conjugation',
])
export type SkillId = typeof SkillId.Type

/** The four tenses of the CE2 programme, in teaching order. */
export const Tense = Schema.Literals(['present', 'imperfect', 'future', 'compound-past'])
export type Tense = typeof Tense.Type
export const tenses: ReadonlyArray<Tense> = ['present', 'imperfect', 'future', 'compound-past']

/** At most this many verbs ticked for one child. */
export const maxConjugationVerbs = 60

export const ConjugationFocus = Schema.Struct({
  tense: Schema.NullOr(Tense),
  verb: Schema.NonEmptyString,
})
export type ConjugationFocus = typeof ConjugationFocus.Type

/** The verbs and tenses a parent ticked in the catalogue. */
export const ConjugationSettings = Schema.Struct({
  focus: Schema.NullOr(ConjugationFocus),
  tenses: Schema.Array(Tense).pipe(Schema.check(Schema.isMaxLength(4))),
  verbs: Schema.Array(Schema.NonEmptyString).pipe(
    Schema.check(Schema.isMaxLength(maxConjugationVerbs)),
  ),
})
export type ConjugationSettings = typeof ConjugationSettings.Type

export const LearningPathSettings = Schema.Struct({
  enabledSkills: Schema.Array(SkillId).pipe(Schema.check(Schema.isMaxLength(11))),
  focusSkill: Schema.NullOr(SkillId),
  mode: Schema.Literals(['automatic', 'manual']),
  subtractionMethod: Schema.Literals(['compensation', 'decomposition']),
  /** Absent, the conjugation path is closed. */
  conjugation: Schema.optional(ConjugationSettings),
})
export type LearningPathSettings = typeof LearningPathSettings.Type

export const defaultLearningPathSettings: LearningPathSettings = {
  enabledSkills: [],
  focusSkill: null,
  mode: 'automatic',
  subtractionMethod: 'compensation',
}

export const Fraction = Schema.Struct({ denominator: Int, numerator: Int })
export type Fraction = typeof Fraction.Type

export const MixedFraction = Schema.Struct({ denominator: Int, numerator: Int, whole: Int })
export type MixedFraction = typeof MixedFraction.Type

export const ComparisonSymbol = Schema.Literals(['<', '=', '>'])

export const PracticeAnswer = Schema.Union([
  Schema.Struct({ type: Schema.Literal('integer'), value: Int }),
  Schema.Struct({ denominator: Int, numerator: Int, type: Schema.Literal('fraction'), whole: Int }),
  Schema.Struct({ symbol: ComparisonSymbol, type: Schema.Literal('comparison') }),
  Schema.Struct({ index: Int, type: Schema.Literal('tick') }),
  Schema.Struct({ ids: Schema.Array(Int), type: Schema.Literal('selection') }),
  Schema.Struct({ type: Schema.Literal('text'), value: Schema.String }),
])
export type PracticeAnswer = typeof PracticeAnswer.Type

const Choices = Schema.Array(PracticeAnswer)

export const ArithmeticExercise = Schema.Struct({
  blank: Schema.Literals(['result', 'left', 'right']),
  choices: Choices,
  kind: Schema.Literal('arithmetic'),
  left: Int,
  operation: Schema.Literals(['add', 'subtract', 'double', 'half']),
  resultFirst: Schema.Boolean,
  right: Int,
  skill: SkillId,
})
export const ColumnExercise = Schema.Struct({
  kind: Schema.Literal('column'),
  operation: Schema.Literals(['add', 'subtract']),
  skill: SkillId,
  terms: Schema.Array(Int),
})
export const FractionReadExercise = Schema.Struct({
  choices: Choices,
  fraction: Fraction,
  kind: Schema.Literal('fraction-read'),
  mode: Schema.Literals(['read', 'build']),
  shape: Schema.Literals(['bed', 'pot']),
  skill: SkillId,
})
export const FractionEqualExercise = Schema.Struct({
  blank: Schema.Literals(['numerator', 'denominator']),
  choices: Choices,
  kind: Schema.Literal('fraction-equal'),
  known: Fraction,
  skill: SkillId,
  target: Fraction,
})
export const FractionPickExercise = Schema.Struct({
  kind: Schema.Literal('fraction-pick'),
  options: Schema.Array(Fraction),
  reference: Fraction,
  skill: SkillId,
})
export const FractionLineExercise = Schema.Struct({
  choices: Choices,
  kind: Schema.Literal('fraction-line'),
  mode: Schema.Literals(['place', 'read']),
  skill: SkillId,
  target: MixedFraction,
  ticks: Int,
  units: Int,
})
export const FractionCompareExercise = Schema.Struct({
  kind: Schema.Literal('fraction-compare'),
  left: Fraction,
  right: Fraction,
  skill: SkillId,
})
export const FractionOperationExercise = Schema.Struct({
  choices: Choices,
  kind: Schema.Literal('fraction-operation'),
  left: Fraction,
  operation: Schema.Literals(['add', 'subtract']),
  right: Fraction,
  skill: SkillId,
  story: Schema.Boolean,
})

export const ConjugationExercise = Schema.Struct({
  /** Four forms while discovering; empty when the child writes the form. */
  choices: Choices,
  /** The form expected, without the subject. */
  expected: Schema.String,
  kind: Schema.Literal('conjugation'),
  /** Letter tiles to write the form with; empty while discovering. */
  letters: Schema.Array(Schema.String),
  /** 0 to 5: je, tu, il or elle, nous, vous, ils or elles. */
  person: Int,
  skill: SkillId,
  /** The subject shown, elided when needed (« j’ »). */
  subject: Schema.String,
  tense: Tense,
  verb: Schema.String,
})
export type ConjugationExercise = typeof ConjugationExercise.Type

export const Exercise = Schema.Union([
  ArithmeticExercise,
  ColumnExercise,
  FractionReadExercise,
  FractionEqualExercise,
  FractionPickExercise,
  FractionLineExercise,
  FractionCompareExercise,
  FractionOperationExercise,
  ConjugationExercise,
])
export type Exercise = typeof Exercise.Type

/** What an exercise screen needs besides its prompt (`describeExercise`). */
/** A part of a written form: « fin · iss · ent », or « ont · fini ». */
export const FormPart = Schema.Struct({
  role: Schema.Literals(['auxiliary', 'ending', 'mark', 'stem']),
  text: Schema.String,
})
export type FormPart = typeof FormPart.Type

export const ExerciseDescription = Schema.Struct({
  /** Conjugation: every form counted right, the reference first. */
  accepted: Schema.optional(Schema.Array(Schema.String)),
  columnResult: Schema.optional(Int),
  /** Conjugation: a well-known verb conjugated the same way, for hints. */
  cousin: Schema.optional(Schema.NullOr(Schema.String)),
  /** Conjugation: the parts of the expected form. */
  parts: Schema.optional(Schema.Array(FormPart)),
  equalOptions: Schema.optional(Schema.Array(Int)),
  expected: PracticeAnswer,
  operationResult: Schema.optional(Fraction),
  production: Schema.Boolean,
  tickIndex: Schema.optional(Int),
})
export type ExerciseDescription = typeof ExerciseDescription.Type

export const MasteryState = Schema.Literals(['unseen', 'learning', 'familiar', 'fluent'])
export type MasteryState = typeof MasteryState.Type

export const FactMastery = Schema.Struct({
  correctCount: Int,
  correctStreak: Int,
  difficulty: Schema.Number,
  dueAt: Schema.NullOr(Millis),
  lastReviewedAt: Schema.NullOr(Millis),
  lastReviewedDayKey: Schema.optional(DayKey),
  lapseCount: Int,
  latencyMs: Schema.NullOr(Schema.Number),
  recallDayKeys: Schema.Array(DayKey),
  successfulDayKeys: Schema.Array(DayKey),
  stabilityDays: Schema.Number,
  state: MasteryState,
})
export type FactMastery = typeof FactMastery.Type

export const LearningSnapshot = Schema.Struct({
  algorithmVersion: Schema.String,
  facts: Schema.Record(Schema.String, FactMastery),
  processedEventIds: Schema.Array(Schema.String),
})
export type LearningSnapshot = typeof LearningSnapshot.Type

export const AnswerMode = Schema.Literals(['choice', 'keypad'])
export const QuestionOperation = Schema.Literals(['divide', 'multiply'])
export const SessionKind = Schema.Literals(['daily-watering', 'extra-practice', 'meadow-watering'])
export type SessionKind = typeof SessionKind.Type

export const PracticeQuestion = Schema.Struct({
  answerMode: AnswerMode,
  choices: Schema.Array(Int),
  exercise: Schema.optional(Exercise),
  factKey: Schema.String,
  id: Schema.String,
  left: Int,
  operation: QuestionOperation,
  right: Int,
})
export type PracticeQuestion = typeof PracticeQuestion.Type

export const PracticeSession = Schema.Struct({
  /** The composition rules the session was made with; absent is version 1. */
  algorithmVersion: Schema.optional(Schema.String),
  createdAt: Millis,
  currentQuestionStartedAt: Millis,
  currentIndex: Int,
  id: Schema.String,
  kind: SessionKind,
  questions: Schema.Array(PracticeQuestion),
  seed: Int,
  timeZone: Schema.String,
})
export type PracticeSession = typeof PracticeSession.Type

export const AttemptEvent = Schema.Struct({
  algorithmVersion: Schema.optional(Schema.String),
  answerMode: AnswerMode,
  answeredAt: Millis,
  choices: Schema.Array(Int),
  correct: Schema.Boolean,
  eventId: Schema.String,
  exercise: Schema.optional(Exercise),
  factKey: Schema.String,
  latencyMs: Schema.Number,
  learningDayKey: Schema.optional(DayKey),
  left: Int,
  operation: Schema.optional(QuestionOperation),
  questionCount: Int,
  response: Schema.optional(PracticeAnswer),
  right: Int,
  selected: Int,
  sequence: Int,
  sessionId: Schema.String,
  sessionKind: Schema.optional(SessionKind),
})
export type AttemptEvent = typeof AttemptEvent.Type

export const CurriculumPack = Schema.Literals(['core', 'bonus-11-12', 'inverse-division'])
export type CurriculumPack = typeof CurriculumPack.Type

export const CurriculumPolicy = Schema.Struct({
  packs: Schema.optional(Schema.Array(CurriculumPack)),
  paths: Schema.optional(LearningPathSettings),
})
export type CurriculumPolicy = typeof CurriculumPolicy.Type

export const PracticePolicy = Schema.Struct({
  /**
   * `'2'` caps a daily watering at two new items; `'3'` also leaves the verbs to the meadow's
   * watering. Absent, sessions follow version 1.
   */
  algorithmVersion: Schema.optional(Schema.Literals(['1', '2', '3'])),
  curriculum: Schema.optional(CurriculumPolicy),
  focusSkill: Schema.optional(SkillId),
  focusTable: Schema.optional(Int),
  /** A session on one verb, outside the daily watering. */
  focusVerb: Schema.optional(ConjugationFocus),
  kind: Schema.optional(SessionKind),
  questionCount: Schema.optional(Int),
})
export type PracticePolicy = typeof PracticePolicy.Type

export const AnswerOutcome = Schema.Struct({
  correct: Schema.Boolean,
  event: AttemptEvent,
  session: PracticeSession,
})
export type AnswerOutcome = typeof AnswerOutcome.Type

const Counts = Schema.Struct({ familiar: Int, fluent: Int, growing: Int, total: Int, unseen: Int })

const PackUnlock = Schema.Struct({
  current: Int,
  reason: Schema.NullOr(Schema.Literals(['core-not-stable', 'no-fluent-family'])),
  required: Int,
  unlocked: Schema.Boolean,
})

export const CurriculumPackProgress = Schema.Struct({
  bonus1112: PackUnlock,
  core: PackUnlock,
  inverseDivision: PackUnlock,
})

export const SkillProgress = Schema.Struct({
  familiar: Int,
  fluent: Int,
  growing: Int,
  id: SkillId,
  open: Schema.Boolean,
  openLevels: Int,
  prerequisiteMet: Schema.Boolean,
  total: Int,
  unseen: Int,
})
export type SkillProgress = typeof SkillProgress.Type

export const PathProgress = Schema.Struct({
  id: PathId,
  open: Schema.Boolean,
  skills: Schema.Array(SkillProgress),
})
export type PathProgress = typeof PathProgress.Type

export const OpenSkill = Schema.Struct({
  forced: Schema.Boolean,
  id: SkillId,
  keys: Schema.Array(Schema.String),
})
export type OpenSkill = typeof OpenSkill.Type

export const VerbGroup = Schema.Literals(['first', 'second', 'third', 'auxiliary'])
export type VerbGroup = typeof VerbGroup.Type

export const VerbProgress = Schema.Struct({
  group: VerbGroup,
  tenses: Schema.Array(Schema.Struct({ state: MasteryState, tense: Tense })),
  verb: Schema.String,
})
export type VerbProgress = typeof VerbProgress.Type

export const LearningProgress = Schema.Struct({
  /** The verbs a parent ticked, in the order ticked; absent without any. */
  conjugation: Schema.optional(Schema.Array(VerbProgress)),
  divisionFacts: Counts,
  facts: Counts,
  packs: CurriculumPackProgress,
  paths: Schema.Array(PathProgress),
  tables: Schema.Array(Schema.Struct({ facts: Counts, table: Int })),
})
export type LearningProgress = typeof LearningProgress.Type

export const PracticeRhythm = Schema.Struct({
  comeback: Schema.Literals(['long', 'none', 'short']),
  dailyWateringDone: Schema.Boolean,
  petalCount: Int,
  totalRewardedDays: Int,
  visitsUntilBloomingWeek: Int,
  week: Schema.Array(
    Schema.Struct({ dayKey: DayKey, practiced: Schema.Boolean, today: Schema.Boolean }),
  ),
  weeklyPracticeDays: Int,
})
export type PracticeRhythm = typeof PracticeRhythm.Type

export const GardenRewardLedger = Schema.Struct({
  gardenBloomCount: Int,
  gardenBloomsEarned: Int,
  rewardedDayKeys: Schema.Array(DayKey),
})
export type GardenRewardLedger = typeof GardenRewardLedger.Type

export const GardenReward = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(['background', 'flower', 'pot', 'sparkle']),
  label: Schema.String,
})
export type GardenReward = typeof GardenReward.Type

export const GardenPlantProgress = Schema.Struct({
  bloomsEarned: Int,
  bloomsRequired: Int,
  chapterId: Schema.String,
  collected: Schema.Boolean,
  id: Schema.String,
  lockedUntilStart: Schema.Boolean,
  masteryRemaining: Int,
  masteryRequired: Int,
  matureAt: Int,
  name: Schema.String,
  stage: Schema.Literals(['dormant', 'growing', 'locked', 'mature']),
  startAt: Int,
})
export type GardenPlantProgress = typeof GardenPlantProgress.Type

export const GardenProgress = Schema.Struct({
  bloomCount: Int,
  chapters: Schema.Array(
    Schema.Struct({
      collectedCount: Int,
      id: Schema.String,
      matureAt: Int,
      name: Schema.String,
      plants: Schema.Array(GardenPlantProgress),
      stage: Schema.Literals(['complete', 'growing', 'locked']),
      startAt: Int,
      totalCount: Int,
    }),
  ),
  collection: Schema.Struct({ collectedCount: Int, complete: Schema.Boolean, totalCount: Int }),
  featuredPlant: Schema.NullOr(GardenPlantProgress),
  nextStep: Schema.NullOr(
    Schema.Struct({
      blockedByMastery: Schema.Boolean,
      bloomsRemaining: Int,
      fluentFactsRemaining: Int,
      plant: GardenPlantProgress,
      practiceDaysRemaining: Int,
      targetAt: Int,
      targetStage: Schema.Literals(['growing', 'mature']),
      unlocksPot: Schema.Boolean,
    }),
  ),
  plants: Schema.Array(GardenPlantProgress),
  rewards: Schema.Array(GardenReward),
})
export type GardenProgress = typeof GardenProgress.Type

export const SessionInsight = Schema.NullOr(
  Schema.Struct({
    count: Int,
    factKeys: Schema.Array(Schema.String),
    kind: Schema.Literals([
      'facts-became-familiar',
      'facts-became-fluent',
      'facts-practised',
      'keypad-recalls',
      'mistakes-recovered',
    ]),
  }),
)
export type SessionInsight = typeof SessionInsight.Type

const BridgeFact = Schema.Struct({ factKey: Schema.String, factor: Int, product: Int })

export const RescueStrategy = Schema.Union([
  Schema.Struct({ columns: Int, kind: Schema.Literal('array'), rows: Int, total: Int }),
  Schema.Struct({ kind: Schema.Literal('commutative-flip'), left: Int, right: Int, total: Int }),
  Schema.Struct({
    adjustment: BridgeFact,
    anchor: BridgeFact,
    commonFactor: Int,
    kind: Schema.Literal('known-fact-bridge'),
    operator: Schema.Literals(['add', 'subtract']),
    targetFactor: Int,
    total: Int,
  }),
])
export type RescueStrategy = typeof RescueStrategy.Type

/** A verb conjugated at the four tenses, for the parent's verb sheet (`verbTable`). */
export const VerbTable = Schema.Struct({
  auxiliary: Schema.Literals(['avoir', 'etre']),
  cousin: Schema.NullOr(Schema.String),
  /** The infinitive in the 1990 spelling (« connaitre »). */
  display: Schema.String,
  group: VerbGroup,
  impersonal: Schema.Boolean,
  tenses: Schema.Array(
    Schema.Struct({
      rows: Schema.Array(
        Schema.Struct({
          form: Schema.String,
          parts: Schema.Array(FormPart),
          person: Int,
          subjects: Schema.Array(Schema.String),
        }),
      ),
      tense: Tense,
    }),
  ),
  verb: Schema.String,
})
export type VerbTable = typeof VerbTable.Type

/** The shape of a verb's flower in the meadow, drawn from its group's family. */
export const MeadowSilhouette = Schema.Literals([
  'sunflower',
  'tulip',
  'daisy',
  'cosmos',
  'bellflower',
  'cornflower',
  'dahlia',
  'poppy',
  'anemone',
])
export type MeadowSilhouette = typeof MeadowSilhouette.Type

export const MeadowPalette = Schema.Literals([
  'gold',
  'rose',
  'indigo',
  'coral',
  'violet',
  'mint',
  'red',
  'white',
  'peach',
  'lavender',
])
export type MeadowPalette = typeof MeadowPalette.Type

export const MeadowStage = Schema.Literals(['seed', 'growing', 'mature'])
export type MeadowStage = typeof MeadowStage.Type

export const MeadowVerb = Schema.Struct({
  /** The days of the last seven when a butterfly landed on the verb, oldest first. */
  butterflyDayKeys: Schema.Array(Schema.String),
  group: VerbGroup,
  palette: MeadowPalette,
  silhouette: MeadowSilhouette,
  stage: MeadowStage,
  /** The ticked tenses, in the parent's order. */
  tenses: Schema.Array(Schema.Struct({ state: MasteryState, tense: Tense })),
  verb: Schema.String,
})
export type MeadowVerb = typeof MeadowVerb.Type

/** The verb meadow (`deriveMeadow`), derived from the snapshot and the parent's verbs. */
export const MeadowProgress = Schema.Struct({
  butterfliesThisWeek: Int,
  /** The verb to water when no ticked verb was seen for three days; `null` otherwise. */
  thirst: Schema.NullOr(Schema.Struct({ daysSince: Int, verb: Schema.String })),
  /** Auxiliaries, then the first, second and third groups; the parent's order within a group. */
  verbs: Schema.Array(MeadowVerb),
})
export type MeadowProgress = typeof MeadowProgress.Type

import { Schema } from 'effect'

export const CE2_CONTENT_VERSION = 'ce2-2026-v1' as const
export const CE2_MASTERY_ALGORITHM_VERSION = 'ce2-mastery/v1' as const

export const Ce2ModuleSchema = Schema.Literal('arithmetic', 'fractions')
export type Ce2Module = typeof Ce2ModuleSchema.Type

export const Ce2DailyFamilySchema = Schema.Literal('tables', 'arithmetic', 'fractions')
export type Ce2DailyFamily = typeof Ce2DailyFamilySchema.Type

export const Ce2SkillSchema = Schema.Literal(
  'N1',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'P1',
  'P2',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
)
export type Ce2Skill = typeof Ce2SkillSchema.Type

export const Ce2TierSchema = Schema.Literal(1, 2, 3, 4)
export type Ce2Tier = typeof Ce2TierSchema.Type

export const Ce2RepresentationSchema = Schema.Literal(
  'blocks',
  'decomposition',
  'number-line',
  'column-grid',
  'bar',
  'disk',
  'graduated-line',
  'unit-strip',
  'part-whole',
)
export type Ce2Representation = typeof Ce2RepresentationSchema.Type

export const Ce2ResponseModeSchema = Schema.Literal(
  'choice',
  'keypad',
  'place-value',
  'fraction',
  'comparison',
  'multi-select',
  'operation',
  'number-line',
  'length',
  'column',
  'ordering',
  'problem',
)
export type Ce2ResponseMode = typeof Ce2ResponseModeSchema.Type

export const Ce2IntegerOperationSchema = Schema.Literal('add', 'subtract')
export type Ce2IntegerOperation = typeof Ce2IntegerOperationSchema.Type

export const Ce2RelationSchema = Schema.Literal('less', 'equal', 'greater')
export type Ce2Relation = typeof Ce2RelationSchema.Type

export const Ce2ColumnNameSchema = Schema.Literal('thousands', 'hundreds', 'tens', 'units')
export type Ce2ColumnName = typeof Ce2ColumnNameSchema.Type

export const Ce2RationalSchema = Schema.Struct({
  denominator: Schema.Positive.pipe(Schema.int()),
  numerator: Schema.NonNegativeInt,
})
export type Ce2Rational = typeof Ce2RationalSchema.Type

const IntegerAnswerSchema = Schema.Struct({
  type: Schema.Literal('integer'),
  value: Schema.NonNegativeInt,
})
const PlaceValueAnswerSchema = Schema.Struct({
  hundreds: Schema.NonNegativeInt,
  tens: Schema.NonNegativeInt,
  type: Schema.Literal('place-value'),
  units: Schema.NonNegativeInt,
})
const FractionAnswerSchema = Schema.Struct({
  denominator: Schema.Positive.pipe(Schema.int()),
  numerator: Schema.NonNegativeInt,
  type: Schema.Literal('fraction'),
})
const ComparisonAnswerSchema = Schema.Struct({
  relation: Ce2RelationSchema,
  type: Schema.Literal('comparison'),
})
const SelectionAnswerSchema = Schema.Struct({
  choiceIds: Schema.Array(Schema.NonEmptyString),
  type: Schema.Literal('selection'),
})
const OperationAnswerSchema = Schema.Struct({
  operation: Ce2IntegerOperationSchema,
  type: Schema.Literal('operation'),
})
const NumberLineAnswerSchema = Schema.Struct({
  tick: Schema.NonNegativeInt,
  type: Schema.Literal('number-line'),
})
const LengthAnswerSchema = Schema.Struct({
  denominator: Schema.Positive.pipe(Schema.int()),
  numerator: Schema.NonNegativeInt,
  type: Schema.Literal('length'),
  whole: Schema.NonNegativeInt,
})
const ColumnAnswerSchema = Schema.Struct({
  alignment: Schema.Array(
    Schema.Struct({
      column: Ce2ColumnNameSchema,
      digit: Schema.NonNegativeInt.pipe(Schema.lessThanOrEqualTo(9)),
      operand: Schema.Literal('left', 'right'),
    }),
  ),
  type: Schema.Literal('column'),
  value: Schema.NonNegativeInt,
})
const OrderingAnswerSchema = Schema.Struct({
  orderedIds: Schema.Array(Schema.NonEmptyString),
  type: Schema.Literal('ordering'),
})
const ProblemAnswerSchema = Schema.Struct({
  intermediateResults: Schema.Array(Schema.NonNegativeInt),
  operation: Schema.NullOr(Ce2IntegerOperationSchema),
  type: Schema.Literal('problem'),
  value: Schema.NullOr(Schema.NonNegativeInt),
})

export const Ce2AnswerSchema = Schema.Union(
  IntegerAnswerSchema,
  PlaceValueAnswerSchema,
  FractionAnswerSchema,
  ComparisonAnswerSchema,
  SelectionAnswerSchema,
  OperationAnswerSchema,
  NumberLineAnswerSchema,
  LengthAnswerSchema,
  ColumnAnswerSchema,
  OrderingAnswerSchema,
  ProblemAnswerSchema,
)
export type Ce2Answer = typeof Ce2AnswerSchema.Type

export const Ce2ChoiceSchema = Schema.Struct({
  answer: Ce2AnswerSchema,
  id: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
})
export type Ce2Choice = typeof Ce2ChoiceSchema.Type

export const Ce2InputConstraintsSchema = Schema.Struct({
  denominatorMax: Schema.NullOr(Schema.Int.pipe(Schema.between(1, 12))),
  explicitValidation: Schema.Literal(true),
  maxDigits: Schema.NullOr(Schema.Int.pipe(Schema.between(1, 4))),
  maximumSelections: Schema.NullOr(Schema.Positive.pipe(Schema.int())),
  minimumSelections: Schema.NullOr(Schema.NonNegativeInt),
  numeratorMax: Schema.NullOr(Schema.Int.pipe(Schema.between(0, 12))),
})
export type Ce2InputConstraints = typeof Ce2InputConstraintsSchema.Type

const questionCommon = {
  choices: Schema.Array(Ce2ChoiceSchema),
  contentVersion: Schema.Literal(CE2_CONTENT_VERSION),
  generationSeed: Schema.Int,
  id: Schema.NonEmptyString,
  inputConstraints: Ce2InputConstraintsSchema,
  module: Ce2ModuleSchema,
  noveltyKey: Schema.NonEmptyString,
  prompt: Schema.NonEmptyString,
  representation: Ce2RepresentationSchema,
  requiredDenominator: Schema.NullOr(Schema.Positive.pipe(Schema.int())),
  responseMode: Ce2ResponseModeSchema,
  schemaVersion: Schema.Literal('ce2-question/v1'),
  skill: Ce2SkillSchema,
  tier: Ce2TierSchema,
}

const PlaceValueQuestionSchema = Schema.Struct({
  ...questionCommon,
  family: Schema.Literal('place-value'),
  solution: PlaceValueAnswerSchema,
  value: Schema.Int.pipe(Schema.between(0, 999)),
})
const IntegerQuestionSchema = Schema.Struct({
  ...questionCommon,
  family: Schema.Literal('integer'),
  left: Schema.Int.pipe(Schema.between(0, 999)),
  operation: Ce2IntegerOperationSchema,
  right: Schema.Int.pipe(Schema.between(0, 999)),
  solution: IntegerAnswerSchema,
  strategy: Schema.Literal('place-value', 'landmark', 'compensation', 'direct'),
})
const ColumnQuestionSchema = Schema.Struct({
  ...questionCommon,
  family: Schema.Literal('column'),
  left: Schema.Int.pipe(Schema.between(0, 999)),
  mode: Schema.Literal('guided', 'autonomous'),
  operation: Ce2IntegerOperationSchema,
  requiresCarry: Schema.Boolean,
  requiresExchange: Schema.Boolean,
  right: Schema.Int.pipe(Schema.between(0, 999)),
  solution: ColumnAnswerSchema,
  zeroBridge: Schema.Boolean,
})
const ProblemQuestionSchema = Schema.Struct({
  ...questionCommon,
  family: Schema.Literal('problem'),
  operations: Schema.Array(Ce2IntegerOperationSchema),
  solution: Schema.Union(ProblemAnswerSchema, FractionAnswerSchema),
  story: Schema.NonEmptyString,
  values: Schema.Array(Schema.NonNegativeInt),
})
const OrderingQuestionSchema = Schema.Struct({
  ...questionCommon,
  family: Schema.Literal('ordering'),
  items: Schema.Array(
    Schema.Struct({
      id: Schema.NonEmptyString,
      value: Ce2RationalSchema,
    }),
  ),
  solution: OrderingAnswerSchema,
})
const FractionQuestionSchema = Schema.Struct({
  ...questionCommon,
  family: Schema.Literal('fraction'),
  operands: Schema.Array(Ce2RationalSchema),
  partitions: Schema.Array(
    Schema.Struct({
      id: Schema.NonEmptyString,
      segmentWeights: Schema.Array(Schema.Positive),
    }),
  ),
  solution: Schema.Union(FractionAnswerSchema, SelectionAnswerSchema),
  task: Schema.Literal('equal-parts', 'represent', 'equivalence', 'add', 'subtract'),
})
const ComparisonQuestionSchema = Schema.Struct({
  ...questionCommon,
  family: Schema.Literal('comparison'),
  left: Ce2RationalSchema,
  right: Ce2RationalSchema,
  solution: ComparisonAnswerSchema,
})
const NumberLineQuestionSchema = Schema.Struct({
  ...questionCommon,
  denominator: Schema.Int.pipe(Schema.between(2, 12)),
  family: Schema.Literal('number-line'),
  solution: NumberLineAnswerSchema,
  target: Ce2RationalSchema,
  tickCount: Schema.Int.pipe(Schema.between(2, 12)),
})
const LengthQuestionSchema = Schema.Struct({
  ...questionCommon,
  family: Schema.Literal('length'),
  fraction: Ce2RationalSchema,
  solution: LengthAnswerSchema,
  wholeUnits: Schema.NonNegativeInt,
})

export const Ce2QuestionSchema = Schema.Union(
  PlaceValueQuestionSchema,
  IntegerQuestionSchema,
  ColumnQuestionSchema,
  ProblemQuestionSchema,
  FractionQuestionSchema,
  ComparisonQuestionSchema,
  NumberLineQuestionSchema,
  LengthQuestionSchema,
  OrderingQuestionSchema,
)
export type Ce2Question = typeof Ce2QuestionSchema.Type

export const Ce2EvaluationSchema = Schema.Struct({
  canonicalValue: Schema.NullOr(Schema.String),
  dimensions: Schema.Struct({
    alignment: Schema.NullOr(Schema.Boolean),
    format: Schema.Boolean,
    intermediate: Schema.NullOr(Schema.Boolean),
    model: Schema.NullOr(Schema.Boolean),
    ordering: Schema.NullOr(Schema.Boolean),
    procedure: Schema.NullOr(Schema.Boolean),
    value: Schema.Boolean,
  }),
  reason: Schema.Literal(
    'correct',
    'wrong-value',
    'wrong-answer-kind',
    'invalid-question',
    'equivalent-needs-format',
    'wrong-alignment',
  ),
  status: Schema.Literal('correct', 'equivalent-needs-format', 'incorrect'),
})
export type Ce2Evaluation = typeof Ce2EvaluationSchema.Type

export const Ce2AssistanceSchema = Schema.Struct({
  guided: Schema.Boolean,
  helpOpened: Schema.Boolean,
  representationHints: Schema.NonNegativeInt,
  resultRevealed: Schema.Boolean,
  switchedToFree: Schema.Boolean,
})
export type Ce2Assistance = typeof Ce2AssistanceSchema.Type

export const Ce2ColumnStepSchema = Schema.Struct({
  column: Ce2ColumnNameSchema,
  exchangedFrom: Schema.NullOr(Ce2ColumnNameSchema),
  incoming: Schema.NonNegativeInt,
  operation: Ce2IntegerOperationSchema,
  outgoing: Schema.NonNegativeInt,
  resultDigit: Schema.Int.pipe(Schema.between(0, 9)),
})
export type Ce2ColumnStep = typeof Ce2ColumnStepSchema.Type

const ce2AttemptFields = {
  answer: Ce2AnswerSchema,
  assistance: Ce2AssistanceSchema,
  columnSteps: Schema.Array(Ce2ColumnStepSchema),
  evaluation: Ce2EvaluationSchema,
  eventId: Schema.NonEmptyString,
  latencyMs: Schema.NonNegativeInt,
  learningDayKey: Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/)),
  question: Ce2QuestionSchema,
  questionCount: Schema.Positive.pipe(Schema.int()),
  schemaVersion: Schema.Literal('ce2-attempt/v1'),
  sequence: Schema.NonNegativeInt,
  sessionId: Schema.NonEmptyString,
  sessionKind: Schema.Literal('daily-watering', 'extra-practice', 'discovery'),
}

export const Ce2AttemptSchema = Schema.Struct({
  ...ce2AttemptFields,
  answeredAt: Schema.ValidDateFromSelf,
})
export type Ce2Attempt = typeof Ce2AttemptSchema.Type

export const Ce2AttemptWireSchema = Schema.Struct({
  ...ce2AttemptFields,
  answeredAt: Schema.DateFromString,
})
export type Ce2AttemptWire = typeof Ce2AttemptWireSchema.Encoded

const ce2DraftFields = {
  activeColumn: Schema.NullOr(Ce2ColumnNameSchema),
  activeElapsedMs: Schema.NonNegativeInt,
  answer: Schema.NullOr(Ce2AnswerSchema),
  borrows: Schema.Record({ key: Schema.String, value: Schema.NonNegativeInt }),
  carries: Schema.Record({ key: Schema.String, value: Schema.NonNegativeInt }),
  columnEntries: Schema.Record({ key: Schema.String, value: Schema.NonNegativeInt }),
  freeMode: Schema.Boolean,
  helpOpened: Schema.Boolean,
  questionId: Schema.NonEmptyString,
  orderedIds: Schema.Array(Schema.NonEmptyString),
  resultRevealed: Schema.Boolean,
  schemaVersion: Schema.Literal('ce2-draft/v1'),
  selectedPartIds: Schema.Array(Schema.NonEmptyString),
  switchedToFree: Schema.Boolean,
}

export const Ce2DraftSchema = Schema.Struct({
  ...ce2DraftFields,
  updatedAt: Schema.ValidDateFromSelf,
})
export type Ce2Draft = typeof Ce2DraftSchema.Type

export const Ce2DraftWireSchema = Schema.Struct({
  ...ce2DraftFields,
  updatedAt: Schema.DateFromString,
})
export type Ce2DraftWire = typeof Ce2DraftWireSchema.Encoded

const ce2SkillMasteryFields = {
  alignmentAutonomous: Schema.Boolean,
  autonomousSuccessCount: Schema.NonNegativeInt,
  correctCount: Schema.NonNegativeInt,
  novelSuccessKeys: Schema.Array(Schema.NonEmptyString),
  procedureEvidence: Schema.Array(Schema.Literal('carry', 'exchange')),
  producedResponseCount: Schema.NonNegativeInt,
  recentAutonomousResults: Schema.Array(Schema.Boolean),
  representations: Schema.Array(Ce2RepresentationSchema),
  state: Schema.Literal('unseen', 'learning', 'familiar', 'fluent'),
  successfulDayKeys: Schema.Array(Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/))),
}

export const Ce2SkillMasterySchema = Schema.Struct({
  ...ce2SkillMasteryFields,
  lastPracticedAt: Schema.NullOr(Schema.ValidDateFromSelf),
})
export type Ce2SkillMastery = typeof Ce2SkillMasterySchema.Type

const Ce2SkillMasteryWireSchema = Schema.Struct({
  ...ce2SkillMasteryFields,
  lastPracticedAt: Schema.NullOr(Schema.DateFromString),
})

const ce2SnapshotFields = {
  algorithmVersion: Schema.Literal(CE2_MASTERY_ALGORITHM_VERSION),
  enabledModules: Schema.Array(Ce2ModuleSchema),
  processedEventIds: Schema.Array(Schema.NonEmptyString),
  recentPrimaryFamilies: Schema.Array(Ce2DailyFamilySchema),
}

export const Ce2SnapshotSchema = Schema.Struct({
  ...ce2SnapshotFields,
  mastery: Schema.Record({ key: Schema.String, value: Ce2SkillMasterySchema }),
})
export type Ce2Snapshot = typeof Ce2SnapshotSchema.Type
export type Ce2LearningSnapshot = Ce2Snapshot
export const Ce2LearningSnapshotSchema = Ce2SnapshotSchema

export const Ce2SnapshotWireSchema = Schema.Struct({
  ...ce2SnapshotFields,
  mastery: Schema.Record({ key: Schema.String, value: Ce2SkillMasteryWireSchema }),
})
export type Ce2SnapshotWire = typeof Ce2SnapshotWireSchema.Encoded

const ce2DailyPlanFields = {
  contentVersion: Schema.Literal(CE2_CONTENT_VERSION),
  enabledFamilies: Schema.Array(Ce2DailyFamilySchema),
  id: Schema.NonEmptyString,
  primaryFamily: Ce2DailyFamilySchema,
  questionCount: Schema.Int.pipe(Schema.between(5, 8)),
  reminderFamilies: Schema.Array(Ce2DailyFamilySchema),
  schemaVersion: Schema.Literal('ce2-daily-plan/v1'),
  seed: Schema.Int,
}

export const Ce2DailyPlanSchema = Schema.Struct({
  ...ce2DailyPlanFields,
  createdAt: Schema.ValidDateFromSelf,
})
export type Ce2DailyPlan = typeof Ce2DailyPlanSchema.Type

export const Ce2DailyPlanWireSchema = Schema.Struct({
  ...ce2DailyPlanFields,
  createdAt: Schema.DateFromString,
})
export type Ce2DailyPlanWire = typeof Ce2DailyPlanWireSchema.Encoded

const ce2SessionFields = {
  currentIndex: Schema.NonNegativeInt,
  id: Schema.NonEmptyString,
  kind: Schema.Literal('daily-watering', 'extra-practice', 'discovery'),
  lastResult: Schema.NullOr(
    Schema.Struct({
      answer: Ce2AnswerSchema,
      evaluation: Ce2EvaluationSchema,
      questionId: Schema.NonEmptyString,
    }),
  ),
  primaryModule: Ce2ModuleSchema,
  questions: Schema.Array(Ce2QuestionSchema),
  schemaVersion: Schema.Literal('ce2-session/v1'),
  seed: Schema.Int,
  timeZone: Schema.NonEmptyString,
}

export const Ce2SessionSchema = Schema.Struct({
  ...ce2SessionFields,
  createdAt: Schema.ValidDateFromSelf,
  currentQuestionStartedAt: Schema.ValidDateFromSelf,
  draft: Schema.NullOr(Ce2DraftSchema),
})
export type Ce2Session = typeof Ce2SessionSchema.Type

export const Ce2SessionWireSchema = Schema.Struct({
  ...ce2SessionFields,
  createdAt: Schema.DateFromString,
  currentQuestionStartedAt: Schema.DateFromString,
  draft: Schema.NullOr(Ce2DraftWireSchema),
})
export type Ce2SessionWire = typeof Ce2SessionWireSchema.Encoded

const ce2PreferencesFields = {
  enabledModules: Schema.Array(Ce2ModuleSchema),
  lastDailyFamily: Schema.NullOr(Ce2DailyFamilySchema),
  schemaVersion: Schema.Literal('ce2-preferences/v1'),
}

export const Ce2PreferencesSchema = Schema.Struct({
  ...ce2PreferencesFields,
  updatedAt: Schema.ValidDateFromSelf,
})
export type Ce2Preferences = typeof Ce2PreferencesSchema.Type

export const Ce2PreferencesWireSchema = Schema.Struct({
  ...ce2PreferencesFields,
  updatedAt: Schema.DateFromString,
})
export type Ce2PreferencesWire = typeof Ce2PreferencesWireSchema.Encoded

const ce2PreferenceUpdateFields = {
  ...ce2PreferencesFields,
  eventId: Schema.NonEmptyString,
  schemaVersion: Schema.Literal('ce2-preference-update/v1'),
}

export const Ce2PreferenceUpdateSchema = Schema.Struct({
  ...ce2PreferenceUpdateFields,
  updatedAt: Schema.ValidDateFromSelf,
})
export type Ce2PreferenceUpdate = typeof Ce2PreferenceUpdateSchema.Type

export const Ce2PreferenceUpdateWireSchema = Schema.Struct({
  ...ce2PreferenceUpdateFields,
  updatedAt: Schema.DateFromString,
})
export type Ce2PreferenceUpdateWire = typeof Ce2PreferenceUpdateWireSchema.Encoded

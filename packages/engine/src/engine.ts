import { Context, Data, Effect, Layer, Schema } from 'effect'

import { learningDayKey } from './day-key.js'
import * as S from './schema.js'

export class EngineError extends Data.TaggedError('EngineError')<{
  readonly message: string
  readonly operation: string
}> {}

/** The exports of the WebAssembly module produced by `tools/build-wasm.sh`. */
export type EngineModule = Readonly<{
  run: (
    operation: string,
    input: string,
    dayKey: (at: number, timeZone: string) => string,
  ) => string
}>

type Result = Readonly<{ error?: string; ok?: unknown }>

const call = <A, I>(
  module: EngineModule,
  operation: string,
  input: unknown,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, EngineError> =>
  Effect.try({
    catch: (cause) => new EngineError({ message: String(cause), operation }),
    try: () =>
      JSON.parse(module.run(operation, JSON.stringify(input ?? null), learningDayKey)) as Result,
  }).pipe(
    Effect.flatMap((result) =>
      result.error === undefined
        ? Schema.decodeUnknown(schema)(result.ok).pipe(
            Effect.mapError((error) => new EngineError({ message: error.message, operation })),
          )
        : Effect.fail(new EngineError({ message: result.error, operation })),
    ),
  )

type Operation<In, Out> = (input: In) => Effect.Effect<Out, EngineError>

export type CreateSessionInput = Readonly<{
  now: number
  policy: S.PracticePolicy
  seed: number
  snapshot: S.LearningSnapshot
  timeZone: string
}>

export type AnswerInput = Readonly<{
  answeredAt: number
  eventId: string
  session: S.PracticeSession
}> &
  (Readonly<{ response: S.PracticeAnswer }> | Readonly<{ selected: number }>)

export type ReduceInput = Readonly<{
  attempts: ReadonlyArray<S.AttemptEvent>
  snapshot: S.LearningSnapshot
  timeZone: string
}>

export type PathsInput = Readonly<{
  settings: S.LearningPathSettings
  snapshot: S.LearningSnapshot
  tablesAcquired: boolean
}>

export type RhythmInput = Readonly<{
  activeSession: Readonly<{
    currentIndex: number
    kind: S.SessionKind
    questionCount: number
  }> | null
  practiceDayKeys: ReadonlyArray<string>
  rewardedDayKeys: ReadonlyArray<string>
  todayKey: string
}>

export type LedgerInput = Readonly<{
  completions: ReadonlyArray<Readonly<{ learningDayKey: string; sessionKind?: S.SessionKind }>>
  gardenBloomCount?: number
  rewardedDayKeys?: ReadonlyArray<string>
}>

export type GardenInput = Readonly<{
  awardedFlowerIds?: ReadonlyArray<string>
  completedSessions: number
  flowerOrder?: ReadonlyArray<string>
  snapshot: S.LearningSnapshot
}>

export type EngineApi = Readonly<{
  answer: Operation<AnswerInput, S.AnswerOutcome>
  correctAnswer: Operation<S.PracticeQuestion, number>
  createSession: Operation<CreateSessionInput, S.PracticeSession>
  deriveGardenProgress: Operation<GardenInput, S.GardenProgress>
  deriveGardenRewardLedger: Operation<LedgerInput, S.GardenRewardLedger>
  deriveLearningProgress: Operation<
    Readonly<{ curriculum?: S.CurriculumPolicy; snapshot: S.LearningSnapshot }>,
    S.LearningProgress
  >
  deriveOpenSkills: Operation<PathsInput, ReadonlyArray<S.OpenSkill>>
  derivePathProgress: Operation<PathsInput, ReadonlyArray<S.PathProgress>>
  derivePracticeRhythm: Operation<RhythmInput, S.PracticeRhythm>
  deriveRescueStrategies: Operation<
    Readonly<{ question: S.PracticeQuestion; snapshot: S.LearningSnapshot }>,
    ReadonlyArray<S.RescueStrategy>
  >
  deriveRewards: Operation<GardenInput, ReadonlyArray<S.GardenReward>>
  deriveSessionInsight: Operation<ReduceInput, S.SessionInsight>
  emptySnapshot: S.LearningSnapshot
  expectedAnswer: Operation<S.Exercise, S.PracticeAnswer>
  isExerciseAnswerCorrect: Operation<
    Readonly<{ answer: S.PracticeAnswer; exercise: S.Exercise }>,
    boolean
  >
  isProductionExercise: Operation<S.Exercise, boolean>
  mergeGardenRewardLedgers: Operation<
    Readonly<{
      ledgers: ReadonlyArray<
        Readonly<{ gardenBloomCount: number; rewardedDayKeys: ReadonlyArray<string> }>
      >
    }>,
    S.GardenRewardLedger
  >
  reduce: Operation<ReduceInput, S.LearningSnapshot>
  validateExerciseAttempt: Operation<S.AttemptEvent, boolean>
}>

export const makeEngine = (module: EngineModule): EngineApi => {
  const operation =
    <In, A, I>(name: string, schema: Schema.Schema<A, I>): Operation<In, A> =>
    (input) =>
      call(module, name, input, schema)
  return {
    answer: operation('answer', S.AnswerOutcome),
    correctAnswer: operation('correctAnswer', Schema.Number),
    createSession: operation('createSession', S.PracticeSession),
    deriveGardenProgress: operation('deriveGardenProgress', S.GardenProgress),
    deriveGardenRewardLedger: operation('deriveGardenRewardLedger', S.GardenRewardLedger),
    deriveLearningProgress: operation('deriveLearningProgress', S.LearningProgress),
    deriveOpenSkills: operation('deriveOpenSkills', Schema.Array(S.OpenSkill)),
    derivePathProgress: operation('derivePathProgress', Schema.Array(S.PathProgress)),
    derivePracticeRhythm: operation('derivePracticeRhythm', S.PracticeRhythm),
    deriveRescueStrategies: operation('deriveRescueStrategies', Schema.Array(S.RescueStrategy)),
    deriveRewards: operation('deriveRewards', Schema.Array(S.GardenReward)),
    deriveSessionInsight: operation('deriveSessionInsight', S.SessionInsight),
    emptySnapshot: { algorithmVersion: '1', facts: {}, processedEventIds: [] },
    expectedAnswer: operation('expectedAnswer', S.PracticeAnswer),
    isExerciseAnswerCorrect: operation('isExerciseAnswerCorrect', Schema.Boolean),
    isProductionExercise: operation('isProductionExercise', Schema.Boolean),
    mergeGardenRewardLedgers: operation('mergeGardenRewardLedgers', S.GardenRewardLedger),
    reduce: operation('reduce', S.LearningSnapshot),
    validateExerciseAttempt: operation('validateExerciseAttempt', Schema.Boolean),
  }
}

/** The learning engine, loaded once per runtime. */
export class Engine extends Context.Tag('@little-tables/engine/Engine')<Engine, EngineApi>() {
  /** Loads the module with `load`, typically the WebAssembly initialiser of the current platform. */
  static readonly layer = (load: () => Promise<EngineModule>): Layer.Layer<Engine, EngineError> =>
    Layer.effect(
      Engine,
      Effect.tryPromise({
        catch: (cause) => new EngineError({ message: String(cause), operation: 'load' }),
        try: load,
      }).pipe(Effect.map(makeEngine)),
    )
}

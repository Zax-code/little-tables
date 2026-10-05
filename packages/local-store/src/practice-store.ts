import {
  ExerciseSchema,
  expectedAnswer,
  LearningEngine,
  PracticeAnswerSchema,
  type AttemptEvent,
  type PracticeAnswer,
  type GardenCollectionSnapshot,
  type LearningSnapshot,
  type PracticeQuestion,
  type PracticeSession,
  type SessionInsight,
} from '@little-tables/domain'
import Dexie, { type EntityTable } from 'dexie'
import { Data, Either, Schema } from 'effect'

type StoredPracticeQuestion = Omit<PracticeQuestion, 'operation'> &
  Readonly<{ operation?: PracticeQuestion['operation'] | undefined }>

type StoredPracticeSession = Omit<PracticeSession, 'kind' | 'questions' | 'timeZone'> &
  Readonly<{
    kind?: PracticeSession['kind'] | undefined
    questions: ReadonlyArray<StoredPracticeQuestion>
    timeZone?: string | undefined
  }>

type StateRecord = Readonly<{
  activeSession: StoredPracticeSession | null
  completedSessions: number
  gardenBloomCount?: number | undefined
  gardenCollection?: GardenCollectionSnapshot | undefined
  id: 'current'
  lastCompletion?: unknown
  practiceDayKeys?: ReadonlyArray<string> | undefined
  rewardedDayKeys?: ReadonlyArray<string> | undefined
  sessionStartSnapshot?: LearningSnapshot | null | undefined
  snapshot: LearningSnapshot
}>

type OutboxRecord = Readonly<{
  attemptId: string
  createdAt: Date
}>

type PracticeDatabase = Dexie & {
  attempts: EntityTable<AttemptEvent, 'eventId'>
  outbox: EntityTable<OutboxRecord, 'attemptId'>
  state: EntityTable<StateRecord, 'id'>
}

export type LocalBootstrap = Readonly<{
  activeSession: PracticeSession | null
  completedSessions: number
  gardenBloomCount: number
  gardenCollection: GardenCollectionSnapshot
  lastCompletion: SessionCompletion | null
  practiceDayKeys: ReadonlyArray<string>
  rewardedDayKeys: ReadonlyArray<string>
  snapshot: LearningSnapshot
}>

export type SessionCompletion = Readonly<{
  bloomNumber: number
  completedAt: Date
  correctAnswers: number
  finalAnswer: number
  /** The expected answer of the last learning-path exercise, when it was not a fact. */
  finalExpected?: PracticeAnswer | undefined
  finalCorrect: boolean
  gardenBloomEarned: boolean
  learningInsight: SessionInsight | null
  learningDayKey: string
  sessionId: string
  sessionKind: PracticeSession['kind']
  totalAnswers: number
}>

export class InvalidStoredCompletionError extends Data.TaggedError('InvalidStoredCompletionError')<{
  cause: unknown
}> {}

export class InvalidStoredStateError extends Data.TaggedError('InvalidStoredStateError')<{
  cause: unknown
}> {}

export class InvalidStoredAttemptError extends Data.TaggedError('InvalidStoredAttemptError')<{
  cause: unknown
}> {}

const SessionCompletionSchema = Schema.Struct({
  bloomNumber: Schema.NonNegativeInt,
  completedAt: Schema.ValidDateFromSelf,
  correctAnswers: Schema.NonNegativeInt,
  finalAnswer: Schema.NonNegativeInt,
  finalCorrect: Schema.Boolean,
  finalExpected: Schema.optional(PracticeAnswerSchema),
  gardenBloomEarned: Schema.optional(Schema.Boolean),
  learningInsight: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        count: Schema.NonNegativeInt,
        factKeys: Schema.Array(Schema.NonEmptyString),
        kind: Schema.Literal(
          'facts-became-familiar',
          'facts-became-fluent',
          'facts-practised',
          'keypad-recalls',
          'mistakes-recovered',
        ),
      }),
    ),
  ),
  learningDayKey: Schema.optional(Schema.NonEmptyString),
  sessionId: Schema.NonEmptyString,
  sessionKind: Schema.optional(Schema.Literal('daily-watering', 'extra-practice')),
  totalAnswers: Schema.Positive.pipe(Schema.int()),
})

const decodeSessionCompletion = (value: unknown): SessionCompletion | null => {
  if (value === null || value === undefined) return null
  const decoded = Schema.decodeUnknownEither(SessionCompletionSchema)(value)
  if (Either.isRight(decoded)) {
    const completion = decoded.right
    return {
      ...completion,
      gardenBloomEarned: completion.gardenBloomEarned ?? true,
      learningInsight: completion.learningInsight ?? null,
      learningDayKey:
        completion.learningDayKey ?? completion.completedAt.toISOString().slice(0, 10),
      sessionKind: completion.sessionKind ?? 'extra-practice',
    }
  }
  throw new InvalidStoredCompletionError({ cause: decoded.left })
}

const FactMasterySchema = Schema.Struct({
  correctCount: Schema.NonNegativeInt,
  correctStreak: Schema.NonNegativeInt,
  difficulty: Schema.Number,
  dueAt: Schema.NullOr(Schema.ValidDateFromSelf),
  lapseCount: Schema.NonNegativeInt,
  lastReviewedAt: Schema.NullOr(Schema.ValidDateFromSelf),
  lastReviewedDayKey: Schema.optional(Schema.NonEmptyString),
  latencyMs: Schema.NullOr(Schema.NonNegativeInt),
  recallDayKeys: Schema.Array(Schema.NonEmptyString),
  stabilityDays: Schema.NonNegative,
  state: Schema.Literal('unseen', 'learning', 'familiar', 'fluent'),
  successfulDayKeys: Schema.Array(Schema.NonEmptyString),
})

const LearningSnapshotSchema = Schema.Struct({
  algorithmVersion: Schema.Literal('1'),
  facts: Schema.Record({ key: Schema.String, value: FactMasterySchema }),
  processedEventIds: Schema.Array(Schema.NonEmptyString),
})

const GardenPlantIdSchema = Schema.Literal(...LearningEngine.gardenFlowerIds)
const GardenCollectionSnapshotSchema = Schema.Struct({
  awardedFlowerIds: Schema.Array(GardenPlantIdSchema),
  bloomsPerFlower: Schema.Literal(LearningEngine.gardenBloomsPerFlower),
  catalogVersion: Schema.Literal('1'),
  flowerOrder: Schema.Array(GardenPlantIdSchema).pipe(
    Schema.filter(
      (order) =>
        order.length === LearningEngine.gardenFlowerIds.length &&
        new Set(order).size === LearningEngine.gardenFlowerIds.length &&
        LearningEngine.gardenFlowerIds.every((id) => order.includes(id)),
      { message: () => 'Garden flower order must contain every flower exactly once' },
    ),
  ),
  introductionSeen: Schema.Boolean,
})

const AttemptEventSchema = Schema.Struct({
  answerMode: Schema.Literal('choice', 'keypad'),
  answeredAt: Schema.ValidDateFromSelf,
  choices: Schema.Array(Schema.Int),
  correct: Schema.Boolean,
  eventId: Schema.NonEmptyString,
  exercise: Schema.optional(ExerciseSchema),
  factKey: Schema.NonEmptyString,
  latencyMs: Schema.NonNegativeInt,
  learningDayKey: Schema.optional(Schema.NonEmptyString),
  // Learning-path exercises carry their operands in `exercise` and record zero here.
  left: Schema.NonNegativeInt,
  operation: Schema.optional(Schema.Literal('multiply', 'divide')),
  questionCount: Schema.Positive.pipe(Schema.int()),
  response: Schema.optional(PracticeAnswerSchema),
  right: Schema.NonNegativeInt,
  selected: Schema.NonNegativeInt,
  sequence: Schema.NonNegativeInt,
  sessionId: Schema.NonEmptyString,
  sessionKind: Schema.optional(Schema.Literal('daily-watering', 'extra-practice')),
})

const StoredPracticeQuestionSchema = Schema.Struct({
  answerMode: Schema.Literal('choice', 'keypad'),
  choices: Schema.Array(Schema.Int),
  exercise: Schema.optional(ExerciseSchema),
  factKey: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  left: Schema.NonNegativeInt,
  operation: Schema.optional(Schema.Literal('multiply', 'divide')),
  right: Schema.NonNegativeInt,
})

const StoredPracticeSessionSchema = Schema.Struct({
  createdAt: Schema.ValidDateFromSelf,
  currentIndex: Schema.NonNegativeInt,
  currentQuestionStartedAt: Schema.ValidDateFromSelf,
  id: Schema.NonEmptyString,
  kind: Schema.optional(Schema.Literal('daily-watering', 'extra-practice')),
  questions: Schema.Array(StoredPracticeQuestionSchema),
  seed: Schema.Int,
  timeZone: Schema.optional(Schema.NonEmptyString),
})

const StateRecordSchema = Schema.Struct({
  activeSession: Schema.NullOr(StoredPracticeSessionSchema),
  completedSessions: Schema.NonNegativeInt,
  gardenBloomCount: Schema.optional(Schema.NonNegativeInt),
  gardenCollection: Schema.optional(GardenCollectionSnapshotSchema),
  id: Schema.Literal('current'),
  lastCompletion: Schema.optional(Schema.Unknown),
  practiceDayKeys: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  rewardedDayKeys: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  sessionStartSnapshot: Schema.optional(Schema.NullOr(LearningSnapshotSchema)),
  snapshot: LearningSnapshotSchema,
})

const decodeStateRecord = (value: unknown): StateRecord | undefined => {
  if (value === undefined) return undefined
  const decoded = Schema.decodeUnknownEither(StateRecordSchema)(value)
  if (Either.isRight(decoded)) return decoded.right
  throw new InvalidStoredStateError({ cause: decoded.left })
}

const decodeAttemptEvent = (value: unknown): AttemptEvent => {
  const decoded = Schema.decodeUnknownEither(AttemptEventSchema)(value)
  if (Either.isRight(decoded)) return decoded.right
  throw new InvalidStoredAttemptError({ cause: decoded.left })
}

const gardenRewardLedgerFor = (state: StateRecord | undefined) =>
  LearningEngine.deriveGardenRewardLedger({
    completions: [],
    gardenBloomCount: state?.gardenBloomCount,
    rewardedDayKeys: state?.rewardedDayKeys ?? state?.practiceDayKeys ?? [],
  })

const defaultGardenCollection = (): GardenCollectionSnapshot => ({
  awardedFlowerIds: [],
  bloomsPerFlower: LearningEngine.gardenBloomsPerFlower,
  catalogVersion: '1',
  flowerOrder: LearningEngine.gardenFlowerIds,
  introductionSeen: false,
})

const normalizeStoredSession = (session: StoredPracticeSession | null): PracticeSession | null =>
  session === null
    ? null
    : {
        ...session,
        kind: session.kind ?? 'extra-practice',
        questions: session.questions.map((question) => ({
          ...question,
          operation: question.operation ?? 'multiply',
        })),
        timeZone: session.timeZone ?? 'UTC',
      }

export type CommitAnswerInput = Readonly<{
  attempt: AttemptEvent
  session: PracticeSession
  snapshot: LearningSnapshot
}>

export type CompleteSessionInput = Readonly<{
  completedAt: Date
  sessionId: string
  snapshot: LearningSnapshot
}>

export type SyncBatch = Readonly<{
  attempts: ReadonlyArray<AttemptEvent>
}>

const createDatabase = (name: string): PracticeDatabase => {
  const database = new Dexie(name) as PracticeDatabase
  database.version(1).stores({
    attempts: '&eventId, sessionId, factKey, answeredAt',
    outbox: '&attemptId, createdAt',
    state: '&id',
  })
  return database
}

export class IndexedDbPracticeStore {
  readonly #database: PracticeDatabase

  constructor(databaseName = 'little-tables') {
    this.#database = createDatabase(databaseName)
  }

  static delete(databaseName: string): Promise<void> {
    return Dexie.delete(databaseName)
  }

  close(): void {
    this.#database.close()
  }

  async load(): Promise<LocalBootstrap> {
    const state = decodeStateRecord(await this.#database.state.get('current'))
    const gardenRewards = gardenRewardLedgerFor(state)
    return state === undefined
      ? {
          activeSession: null,
          completedSessions: 0,
          gardenBloomCount: 0,
          gardenCollection: defaultGardenCollection(),
          lastCompletion: null,
          practiceDayKeys: [],
          rewardedDayKeys: [],
          snapshot: { algorithmVersion: '1', facts: {}, processedEventIds: [] },
        }
      : {
          activeSession: normalizeStoredSession(state.activeSession),
          completedSessions: state.completedSessions,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          gardenCollection: state.gardenCollection ?? defaultGardenCollection(),
          lastCompletion: decodeSessionCompletion(state.lastCompletion),
          practiceDayKeys: state.practiceDayKeys ?? [],
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          snapshot: state.snapshot,
        }
  }

  async commitAnswer({ attempt, session, snapshot }: CommitAnswerInput): Promise<void> {
    await this.#database.transaction(
      'rw',
      [this.#database.attempts, this.#database.outbox, this.#database.state],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const gardenRewards = gardenRewardLedgerFor(current)
        await this.#database.attempts.put(attempt)
        await this.#database.outbox.put({ attemptId: attempt.eventId, createdAt: new Date() })
        const practiceDayKey =
          attempt.learningDayKey ??
          LearningEngine.learningDayKey({
            at: attempt.answeredAt,
            timeZone: session.timeZone,
          })
        await this.#database.state.put({
          activeSession: session,
          completedSessions: current?.completedSessions ?? 0,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          gardenCollection: current?.gardenCollection,
          id: 'current',
          lastCompletion: decodeSessionCompletion(current?.lastCompletion),
          practiceDayKeys: [...new Set([...(current?.practiceDayKeys ?? []), practiceDayKey])],
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          sessionStartSnapshot: current?.sessionStartSnapshot ?? null,
          snapshot,
        })
      },
    )
  }

  async startSession(session: PracticeSession, snapshot: LearningSnapshot): Promise<void> {
    const current = decodeStateRecord(await this.#database.state.get('current'))
    const gardenRewards = gardenRewardLedgerFor(current)
    const continuingSession = current?.activeSession?.id === session.id
    await this.#database.state.put({
      activeSession: session,
      completedSessions: current?.completedSessions ?? 0,
      gardenBloomCount: gardenRewards.gardenBloomCount,
      gardenCollection: current?.gardenCollection,
      id: 'current',
      lastCompletion: decodeSessionCompletion(current?.lastCompletion),
      practiceDayKeys: current?.practiceDayKeys ?? [],
      rewardedDayKeys: gardenRewards.rewardedDayKeys,
      sessionStartSnapshot: continuingSession ? (current.sessionStartSnapshot ?? null) : snapshot,
      snapshot,
    })
  }

  async pendingBatch(limit: number): Promise<SyncBatch> {
    const outbox = await this.#database.outbox.orderBy('createdAt').limit(limit).toArray()
    const attempts = await this.#database.attempts.bulkGet(outbox.map((record) => record.attemptId))
    return {
      attempts: attempts
        .filter((attempt) => attempt !== undefined)
        .map((attempt) => decodeAttemptEvent(attempt)),
    }
  }

  async acknowledge(attemptIds: ReadonlyArray<string>): Promise<void> {
    await this.#database.outbox.bulkDelete([...attemptIds])
  }

  async completeSession({
    completedAt,
    sessionId,
    snapshot,
  }: CompleteSessionInput): Promise<SessionCompletion | null> {
    return this.#database.transaction(
      'rw',
      [this.#database.attempts, this.#database.state],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        if (current === undefined) return null
        const previousCompletion = decodeSessionCompletion(current.lastCompletion)
        if (previousCompletion?.sessionId === sessionId) return previousCompletion

        const session = normalizeStoredSession(current.activeSession)
        if (session === null) return null
        if (session.id !== sessionId || session.currentIndex < session.questions.length) {
          return null
        }

        const finalQuestion = session.questions[session.questions.length - 1]
        if (finalQuestion === undefined) return null
        const attempts = (
          await this.#database.attempts.where('sessionId').equals(sessionId).sortBy('sequence')
        ).map((attempt) => decodeAttemptEvent(attempt))
        const finalAttempt = attempts[attempts.length - 1]
        if (finalAttempt === undefined) return null

        const completedSessions = current.completedSessions + 1
        const currentGardenRewards = gardenRewardLedgerFor(current)
        const learningDayKey =
          finalAttempt.learningDayKey ??
          LearningEngine.learningDayKey({
            at: completedAt,
            timeZone: session.timeZone,
          })
        const gardenRewards = LearningEngine.deriveGardenRewardLedger({
          completions: [{ learningDayKey, sessionKind: session.kind }],
          gardenBloomCount: currentGardenRewards.gardenBloomCount,
          rewardedDayKeys: currentGardenRewards.rewardedDayKeys,
        })
        const gardenBloomEarned = gardenRewards.gardenBloomsEarned === 1
        const completion: SessionCompletion = {
          bloomNumber: gardenRewards.gardenBloomCount,
          completedAt,
          correctAnswers: attempts.filter(({ correct }) => correct).length,
          finalAnswer: LearningEngine.correctAnswer(finalQuestion),
          ...(finalQuestion.exercise === undefined
            ? {}
            : { finalExpected: expectedAnswer(finalQuestion.exercise) }),
          finalCorrect: finalAttempt.correct,
          gardenBloomEarned,
          learningInsight: LearningEngine.deriveSessionInsight({
            attempts,
            snapshot: current.sessionStartSnapshot ?? current.snapshot,
            timeZone: session.timeZone,
          }),
          learningDayKey,
          sessionId,
          sessionKind: session.kind,
          totalAnswers: attempts.length,
        }
        await this.#database.state.put({
          activeSession: null,
          completedSessions,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          gardenCollection: current.gardenCollection,
          id: 'current',
          lastCompletion: completion,
          practiceDayKeys: current.practiceDayKeys ?? [],
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          sessionStartSnapshot: null,
          snapshot,
        })
        return completion
      },
    )
  }

  async replaceSnapshot(
    snapshot: LearningSnapshot,
    serverState?: Readonly<{
      completedSessions: number
      gardenBloomCount?: number
      gardenCollection?: GardenCollectionSnapshot
      practiceDayKeys: ReadonlyArray<string>
      rewardedDayKeys?: ReadonlyArray<string>
    }>,
  ): Promise<void> {
    const stored = decodeStateRecord(await this.#database.state.get('current'))
    const current = await this.load()
    const serverGardenRewards = LearningEngine.deriveGardenRewardLedger({
      completions: [],
      gardenBloomCount: serverState?.gardenBloomCount,
      rewardedDayKeys: serverState?.rewardedDayKeys ?? [],
    })
    const gardenRewards = LearningEngine.mergeGardenRewardLedgers({
      ledgers: [current, serverGardenRewards],
    })
    await this.#database.state.put({
      ...current,
      completedSessions: Math.max(current.completedSessions, serverState?.completedSessions ?? 0),
      gardenBloomCount: gardenRewards.gardenBloomCount,
      gardenCollection: serverState?.gardenCollection ?? current.gardenCollection,
      id: 'current',
      practiceDayKeys: [
        ...new Set([...current.practiceDayKeys, ...(serverState?.practiceDayKeys ?? [])]),
      ],
      rewardedDayKeys: gardenRewards.rewardedDayKeys,
      sessionStartSnapshot:
        stored?.sessionStartSnapshot ?? (current.activeSession === null ? null : current.snapshot),
      snapshot,
    })
  }

  async markGardenIntroductionSeen(): Promise<void> {
    const current = await this.load()
    await this.#database.state.put({
      ...current,
      gardenCollection: {
        ...current.gardenCollection,
        introductionSeen: true,
      },
      id: 'current',
    })
  }
}

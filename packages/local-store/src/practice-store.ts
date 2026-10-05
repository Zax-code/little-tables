import {
  CE2_CONTENT_VERSION,
  CE2_MASTERY_ALGORITHM_VERSION,
  Ce2AttemptSchema,
  Ce2DraftSchema,
  Ce2Engine,
  Ce2ModuleSchema,
  Ce2PreferenceUpdateSchema,
  Ce2PreferencesSchema,
  Ce2SessionSchema,
  Ce2SkillSchema,
  Ce2SnapshotSchema,
  LearningEngine,
  type AttemptEvent,
  type Ce2Attempt,
  type Ce2Draft,
  type Ce2LearningSnapshot,
  type Ce2Module,
  type Ce2PreferenceUpdate,
  type Ce2Preferences,
  type Ce2Session,
  type Ce2Skill,
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
  ce2ActiveSession?: Ce2Session | null | undefined
  ce2ContentVersion?: typeof CE2_CONTENT_VERSION | null | undefined
  ce2Preferences?: Ce2Preferences | undefined
  ce2Snapshot?: Ce2LearningSnapshot | undefined
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

type Ce2OutboxRecord = Readonly<{
  createdAt: Date
  eventId: string
  kind: 'attempt' | 'preference'
}>

type Ce2StateRecord = Readonly<{
  activeSessionId: string | null
  contentVersion: typeof CE2_CONTENT_VERSION | null
  id: 'ce2'
  preferences: Ce2Preferences
  snapshot: Ce2LearningSnapshot
}>

export type Ce2SessionHistoryRecord = Readonly<{
  abandonedAt: Date | null
  completedAt: Date | null
  id: string
  session: Ce2Session
  status: 'active' | 'abandoned' | 'completed'
  updatedAt: Date
}>

type PracticeDatabase = Dexie & {
  attempts: EntityTable<AttemptEvent, 'eventId'>
  ce2Attempts: EntityTable<Ce2Attempt, 'eventId'>
  ce2Outbox: EntityTable<Ce2OutboxRecord, 'eventId'>
  ce2PreferenceUpdates: EntityTable<Ce2PreferenceUpdate, 'eventId'>
  ce2Sessions: EntityTable<Ce2SessionHistoryRecord, 'id'>
  ce2State: EntityTable<Ce2StateRecord, 'id'>
  outbox: EntityTable<OutboxRecord, 'attemptId'>
  state: EntityTable<StateRecord, 'id'>
}

export type LocalBootstrap = Readonly<{
  activeSession: PracticeSession | null
  ce2ActiveSession: Ce2Session | null
  ce2ContentVersion: typeof CE2_CONTENT_VERSION | null
  ce2Preferences: Ce2Preferences
  ce2Snapshot: Ce2LearningSnapshot
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
  ce2Module?: Ce2Module | undefined
  ce2Skill?: Ce2Skill | undefined
  finalAnswer: number
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

export class InvalidStoredCe2AttemptError extends Data.TaggedError('InvalidStoredCe2AttemptError')<{
  cause: unknown
}> {}

const SessionCompletionSchema = Schema.Struct({
  bloomNumber: Schema.NonNegativeInt,
  completedAt: Schema.ValidDateFromSelf,
  correctAnswers: Schema.NonNegativeInt,
  ce2Module: Schema.optional(Ce2ModuleSchema),
  ce2Skill: Schema.optional(Ce2SkillSchema),
  finalAnswer: Schema.NonNegativeInt,
  finalCorrect: Schema.Boolean,
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
  factKey: Schema.NonEmptyString,
  latencyMs: Schema.NonNegativeInt,
  learningDayKey: Schema.optional(Schema.NonEmptyString),
  left: Schema.Positive.pipe(Schema.int()),
  operation: Schema.optional(Schema.Literal('multiply', 'divide')),
  questionCount: Schema.Positive.pipe(Schema.int()),
  right: Schema.Positive.pipe(Schema.int()),
  selected: Schema.NonNegativeInt,
  sequence: Schema.NonNegativeInt,
  sessionId: Schema.NonEmptyString,
  sessionKind: Schema.optional(Schema.Literal('daily-watering', 'extra-practice')),
})

const StoredPracticeQuestionSchema = Schema.Struct({
  answerMode: Schema.Literal('choice', 'keypad'),
  choices: Schema.Array(Schema.Int),
  factKey: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  left: Schema.Positive.pipe(Schema.int()),
  operation: Schema.optional(Schema.Literal('multiply', 'divide')),
  right: Schema.Positive.pipe(Schema.int()),
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
  ce2ActiveSession: Schema.optional(Schema.NullOr(Ce2SessionSchema)),
  ce2ContentVersion: Schema.optional(Schema.NullOr(Schema.Literal(CE2_CONTENT_VERSION))),
  ce2Preferences: Schema.optional(Ce2PreferencesSchema),
  ce2Snapshot: Schema.optional(Ce2SnapshotSchema),
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

const Ce2StateRecordSchema = Schema.Struct({
  activeSessionId: Schema.NullOr(Schema.NonEmptyString),
  contentVersion: Schema.NullOr(Schema.Literal(CE2_CONTENT_VERSION)),
  id: Schema.Literal('ce2'),
  preferences: Ce2PreferencesSchema,
  snapshot: Ce2SnapshotSchema,
})

const decodeStateRecord = (value: unknown): StateRecord | undefined => {
  if (value === undefined) return undefined
  const decoded = Schema.decodeUnknownEither(StateRecordSchema)(value)
  if (Either.isRight(decoded)) return decoded.right
  throw new InvalidStoredStateError({ cause: decoded.left })
}

const decodeCe2StateRecord = (value: unknown): Ce2StateRecord | undefined => {
  if (value === undefined) return undefined
  const decoded = Schema.decodeUnknownEither(Ce2StateRecordSchema)(value)
  if (Either.isRight(decoded)) return decoded.right
  throw new InvalidStoredStateError({ cause: decoded.left })
}

const decodeAttemptEvent = (value: unknown): AttemptEvent => {
  const decoded = Schema.decodeUnknownEither(AttemptEventSchema)(value)
  if (Either.isRight(decoded)) return decoded.right
  throw new InvalidStoredAttemptError({ cause: decoded.left })
}

const decodeCe2Attempt = (value: unknown): Ce2Attempt => {
  const decoded = Schema.decodeUnknownEither(Ce2AttemptSchema)(value)
  if (Either.isRight(decoded)) return decoded.right
  throw new InvalidStoredCe2AttemptError({ cause: decoded.left })
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

const defaultCe2Preferences = (): Ce2Preferences => ({
  enabledModules: [],
  lastDailyFamily: null,
  schemaVersion: 'ce2-preferences/v1',
  updatedAt: new Date(0),
})

const defaultCe2Snapshot = (): Ce2LearningSnapshot => ({
  algorithmVersion: CE2_MASTERY_ALGORITHM_VERSION,
  enabledModules: [],
  mastery: {},
  processedEventIds: [],
  recentPrimaryFamilies: [],
})

const ce2StateFromLegacy = (state: StateRecord | undefined): Ce2StateRecord => ({
  activeSessionId: state?.ce2ActiveSession?.id ?? null,
  contentVersion: state?.ce2ContentVersion ?? null,
  id: 'ce2',
  preferences: state?.ce2Preferences ?? defaultCe2Preferences(),
  snapshot: state?.ce2Snapshot ?? defaultCe2Snapshot(),
})

const mergeCe2Preferences = (first: Ce2Preferences, second: Ce2Preferences): Ce2Preferences => {
  const latest = first.updatedAt.getTime() >= second.updatedAt.getTime() ? first : second
  return {
    enabledModules: [...new Set([...first.enabledModules, ...second.enabledModules])],
    lastDailyFamily: latest.lastDailyFamily,
    schemaVersion: 'ce2-preferences/v1',
    updatedAt: new Date(Math.max(first.updatedAt.getTime(), second.updatedAt.getTime())),
  }
}

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

export type Ce2SyncBatch = Readonly<{
  attempts: ReadonlyArray<Ce2Attempt>
  preferenceUpdates: ReadonlyArray<Ce2PreferenceUpdate>
}>

export class ActiveSessionConflictError extends Data.TaggedError('ActiveSessionConflictError')<{
  activeSessionId: string
  requestedSessionId: string
}> {}

const createDatabase = (name: string): PracticeDatabase => {
  const database = new Dexie(name) as PracticeDatabase
  database.version(1).stores({
    attempts: '&eventId, sessionId, factKey, answeredAt',
    outbox: '&attemptId, createdAt',
    state: '&id',
  })
  database.version(2).stores({
    attempts: '&eventId, sessionId, factKey, answeredAt',
    ce2Attempts: '&eventId, sessionId, answeredAt',
    ce2Outbox: '&eventId, kind, createdAt',
    ce2PreferenceUpdates: '&eventId, updatedAt',
    ce2Sessions: '&id, status, updatedAt',
    outbox: '&attemptId, createdAt',
    state: '&id',
  })
  database.ce2State = database.table('state')
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
    return this.#database.transaction(
      'rw',
      [this.#database.ce2Sessions, this.#database.ce2State, this.#database.state],
      async () => {
        const stored = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(stored)
        const history =
          ce2State.activeSessionId === null
            ? undefined
            : await this.#database.ce2Sessions.get(ce2State.activeSessionId)
        const ce2ActiveSession =
          history?.status === 'active'
            ? history.session
            : stored?.ce2ActiveSession?.id === ce2State.activeSessionId
              ? stored.ce2ActiveSession
              : null
        const reconciledCe2State: Ce2StateRecord = {
          ...ce2State,
          activeSessionId: ce2ActiveSession?.id ?? null,
        }
        const base: StateRecord = stored ?? {
          activeSession: null,
          completedSessions: 0,
          id: 'current',
          snapshot: LearningEngine.emptySnapshot(),
        }
        const gardenRewards = gardenRewardLedgerFor(base)
        const repaired: StateRecord = {
          ...base,
          activeSession: ce2ActiveSession === null ? base.activeSession : null,
          ce2ActiveSession,
          ce2ContentVersion: reconciledCe2State.contentVersion,
          ce2Preferences: reconciledCe2State.preferences,
          ce2Snapshot: reconciledCe2State.snapshot,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
        }
        decodeSessionCompletion(repaired.lastCompletion)
        await this.#database.ce2State.put(reconciledCe2State)
        await this.#database.state.put(repaired)
        return {
          activeSession: normalizeStoredSession(repaired.activeSession),
          ce2ActiveSession,
          ce2ContentVersion: reconciledCe2State.contentVersion,
          ce2Preferences: reconciledCe2State.preferences,
          ce2Snapshot: reconciledCe2State.snapshot,
          completedSessions: repaired.completedSessions,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          gardenCollection: repaired.gardenCollection ?? defaultGardenCollection(),
          lastCompletion: decodeSessionCompletion(repaired.lastCompletion),
          practiceDayKeys: repaired.practiceDayKeys ?? [],
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          snapshot: repaired.snapshot,
        }
      },
    )
  }

  async commitAnswer({ attempt, session, snapshot }: CommitAnswerInput): Promise<void> {
    await this.#database.transaction(
      'rw',
      [
        this.#database.attempts,
        this.#database.ce2State,
        this.#database.outbox,
        this.#database.state,
      ],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        if (ce2State.activeSessionId !== null) {
          throw new ActiveSessionConflictError({
            activeSessionId: ce2State.activeSessionId,
            requestedSessionId: session.id,
          })
        }
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
          ...current,
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
    await this.#database.transaction(
      'rw',
      [this.#database.ce2State, this.#database.state],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        if (ce2State.activeSessionId !== null) {
          throw new ActiveSessionConflictError({
            activeSessionId: ce2State.activeSessionId,
            requestedSessionId: session.id,
          })
        }
        const gardenRewards = gardenRewardLedgerFor(current)
        const continuingSession = current?.activeSession?.id === session.id
        await this.#database.state.put({
          ...current,
          activeSession: session,
          completedSessions: current?.completedSessions ?? 0,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          gardenCollection: current?.gardenCollection,
          id: 'current',
          lastCompletion: decodeSessionCompletion(current?.lastCompletion),
          practiceDayKeys: current?.practiceDayKeys ?? [],
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          sessionStartSnapshot: continuingSession
            ? (current.sessionStartSnapshot ?? null)
            : snapshot,
          snapshot,
        })
        await this.#database.ce2State.put(ce2State)
      },
    )
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

  async abandonSession(sessionId: string): Promise<boolean> {
    return this.#database.transaction('rw', this.#database.state, async () => {
      const current = decodeStateRecord(await this.#database.state.get('current'))
      if (current === undefined || current.activeSession?.id !== sessionId) return false
      await this.#database.state.put({
        ...current,
        activeSession: null,
        sessionStartSnapshot: null,
      })
      return true
    })
  }

  async startCe2Session(session: Ce2Session, snapshot: Ce2LearningSnapshot): Promise<void> {
    await this.#database.transaction(
      'rw',
      [this.#database.ce2Sessions, this.#database.ce2State, this.#database.state],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const storedCe2 =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        const legacySession = normalizeStoredSession(current?.activeSession ?? null)
        if (legacySession !== null && storedCe2.activeSessionId === null) {
          throw new ActiveSessionConflictError({
            activeSessionId: legacySession.id,
            requestedSessionId: session.id,
          })
        }
        if (storedCe2.activeSessionId !== null && storedCe2.activeSessionId !== session.id) {
          throw new ActiveSessionConflictError({
            activeSessionId: storedCe2.activeSessionId,
            requestedSessionId: session.id,
          })
        }
        const gardenRewards = gardenRewardLedgerFor(current)
        const now = new Date()
        await this.#database.ce2Sessions.put({
          abandonedAt: null,
          completedAt: null,
          id: session.id,
          session,
          status: 'active',
          updatedAt: now,
        })
        const nextCe2: Ce2StateRecord = {
          ...storedCe2,
          activeSessionId: session.id,
          snapshot,
        }
        await this.#database.ce2State.put(nextCe2)
        await this.#database.state.put({
          ...current,
          activeSession: null,
          ce2ActiveSession: session,
          ce2ContentVersion: nextCe2.contentVersion,
          ce2Preferences: nextCe2.preferences,
          ce2Snapshot: snapshot,
          completedSessions: current?.completedSessions ?? 0,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          id: 'current',
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          snapshot: current?.snapshot ?? LearningEngine.emptySnapshot(),
        })
      },
    )
  }

  async saveCe2Draft(sessionId: string, draft: Ce2Draft): Promise<boolean> {
    return this.#database.transaction(
      'rw',
      [this.#database.ce2Sessions, this.#database.ce2State, this.#database.state],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        const activeHistory =
          ce2State.activeSessionId === null
            ? undefined
            : await this.#database.ce2Sessions.get(ce2State.activeSessionId)
        const session = activeHistory?.status === 'active' ? activeHistory.session : null
        if (session?.id !== sessionId) return false
        const question = session.questions[session.currentIndex]
        if (question?.id !== draft.questionId) return false
        const decodedDraft = Schema.decodeUnknownSync(Ce2DraftSchema)(draft)
        const updatedSession: Ce2Session = { ...session, draft: decodedDraft }
        const history = activeHistory
        const now = new Date()
        await this.#database.ce2Sessions.put({
          ...history,
          abandonedAt: null,
          completedAt: null,
          id: sessionId,
          session: updatedSession,
          status: 'active',
          updatedAt: now,
        })
        await this.#database.ce2State.put({ ...ce2State, activeSessionId: sessionId })
        const base = current ?? {
          activeSession: null,
          completedSessions: 0,
          id: 'current' as const,
          snapshot: LearningEngine.emptySnapshot(),
        }
        await this.#database.state.put({
          ...base,
          activeSession: null,
          ce2ActiveSession: updatedSession,
          ce2ContentVersion: ce2State.contentVersion,
          ce2Preferences: ce2State.preferences,
          ce2Snapshot: ce2State.snapshot,
          completedSessions: base.completedSessions,
          id: 'current',
          snapshot: base.snapshot,
        })
        return true
      },
    )
  }

  async commitCe2Answer(
    input: Readonly<{
      attempt: Ce2Attempt
      session: Ce2Session
      snapshot: Ce2LearningSnapshot
    }>,
  ): Promise<void> {
    await this.#database.transaction(
      'rw',
      [
        this.#database.ce2Attempts,
        this.#database.ce2Outbox,
        this.#database.ce2Sessions,
        this.#database.ce2State,
        this.#database.state,
      ],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        if (current?.activeSession != null && ce2State.activeSessionId === null) {
          throw new ActiveSessionConflictError({
            activeSessionId: current.activeSession.id,
            requestedSessionId: input.session.id,
          })
        }
        if (ce2State.activeSessionId !== input.session.id) {
          throw new ActiveSessionConflictError({
            activeSessionId: ce2State.activeSessionId ?? 'none',
            requestedSessionId: input.session.id,
          })
        }
        if ((await this.#database.ce2Attempts.get(input.attempt.eventId)) !== undefined) return

        await this.#database.ce2Attempts.add(input.attempt)
        await this.#database.ce2Outbox.add({
          createdAt: new Date(),
          eventId: input.attempt.eventId,
          kind: 'attempt',
        })
        const history = await this.#database.ce2Sessions.get(input.session.id)
        await this.#database.ce2Sessions.put({
          ...history,
          abandonedAt: null,
          completedAt: null,
          id: input.session.id,
          session: input.session,
          status: 'active',
          updatedAt: new Date(),
        })
        const base = current ?? {
          activeSession: null,
          completedSessions: 0,
          id: 'current' as const,
          snapshot: LearningEngine.emptySnapshot(),
        }
        const practiceDayKeys = [
          ...new Set([...(base.practiceDayKeys ?? []), input.attempt.learningDayKey]),
        ].sort()
        const nextCe2: Ce2StateRecord = {
          ...ce2State,
          activeSessionId: input.session.id,
          snapshot: input.snapshot,
        }
        await this.#database.ce2State.put(nextCe2)
        await this.#database.state.put({
          ...base,
          activeSession: null,
          ce2ActiveSession: input.session,
          ce2ContentVersion: nextCe2.contentVersion,
          ce2Preferences: nextCe2.preferences,
          ce2Snapshot: input.snapshot,
          practiceDayKeys,
        })
      },
    )
  }

  async advanceCe2Feedback(sessionId: string, now: Date): Promise<Ce2Session | null> {
    return this.#database.transaction(
      'rw',
      [this.#database.ce2Sessions, this.#database.ce2State, this.#database.state],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        const history =
          ce2State.activeSessionId === null
            ? undefined
            : await this.#database.ce2Sessions.get(ce2State.activeSessionId)
        const session = history?.status === 'active' ? history.session : null
        if (session?.id !== sessionId || session.lastResult === null) {
          return null
        }
        const next: Ce2Session = {
          ...session,
          currentQuestionStartedAt: now,
          lastResult: null,
        }
        await this.#database.ce2Sessions.put({
          ...history,
          abandonedAt: null,
          completedAt: null,
          id: sessionId,
          session: next,
          status: 'active',
          updatedAt: now,
        })
        await this.#database.ce2State.put({ ...ce2State, activeSessionId: sessionId })
        const base = current ?? {
          activeSession: null,
          completedSessions: 0,
          id: 'current' as const,
          snapshot: LearningEngine.emptySnapshot(),
        }
        await this.#database.state.put({
          ...base,
          activeSession: null,
          ce2ActiveSession: next,
          ce2ContentVersion: ce2State.contentVersion,
          ce2Preferences: ce2State.preferences,
          ce2Snapshot: ce2State.snapshot,
          completedSessions: base.completedSessions,
          id: 'current',
          snapshot: base.snapshot,
        })
        return next
      },
    )
  }

  async pendingCe2Batch(limit: number): Promise<Ce2SyncBatch> {
    const records = await this.#database.ce2Outbox.orderBy('createdAt').limit(limit).toArray()
    const attemptIds = records
      .filter(({ kind }) => kind === 'attempt')
      .map(({ eventId }) => eventId)
    const preferenceIds = records
      .filter(({ kind }) => kind === 'preference')
      .map(({ eventId }) => eventId)
    const [attempts, preferenceUpdates] = await Promise.all([
      this.#database.ce2Attempts.bulkGet(attemptIds),
      this.#database.ce2PreferenceUpdates.bulkGet(preferenceIds),
    ])
    return {
      attempts: attempts
        .filter((attempt) => attempt !== undefined)
        .map((attempt) => decodeCe2Attempt(attempt)),
      preferenceUpdates: preferenceUpdates
        .filter((update) => update !== undefined)
        .map((update) => Schema.decodeUnknownSync(Ce2PreferenceUpdateSchema)(update)),
    }
  }

  async acknowledgeCe2(eventIds: ReadonlyArray<string>): Promise<void> {
    await this.#database.ce2Outbox.bulkDelete([...eventIds])
  }

  async updateCe2Preferences(update: Ce2PreferenceUpdate): Promise<Ce2Preferences> {
    return this.#database.transaction(
      'rw',
      [
        this.#database.ce2Outbox,
        this.#database.ce2PreferenceUpdates,
        this.#database.ce2State,
        this.#database.state,
      ],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        const existingUpdate = await this.#database.ce2PreferenceUpdates.get(update.eventId)
        if (existingUpdate !== undefined) {
          return ce2State.preferences
        }
        const next = mergeCe2Preferences(ce2State.preferences, {
          enabledModules: update.enabledModules,
          lastDailyFamily: update.lastDailyFamily,
          schemaVersion: 'ce2-preferences/v1',
          updatedAt: update.updatedAt,
        })
        await this.#database.ce2PreferenceUpdates.add(update)
        await this.#database.ce2Outbox.add({
          createdAt: new Date(),
          eventId: update.eventId,
          kind: 'preference',
        })
        const nextCe2: Ce2StateRecord = { ...ce2State, preferences: next }
        await this.#database.ce2State.put(nextCe2)
        const gardenRewards = gardenRewardLedgerFor(current)
        await this.#database.state.put({
          ...current,
          activeSession: current?.activeSession ?? null,
          ce2ActiveSession: current?.ce2ActiveSession ?? null,
          ce2ContentVersion: nextCe2.contentVersion,
          ce2Preferences: next,
          ce2Snapshot: nextCe2.snapshot,
          completedSessions: current?.completedSessions ?? 0,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          id: 'current',
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          snapshot: current?.snapshot ?? LearningEngine.emptySnapshot(),
        })
        return next
      },
    )
  }

  async abandonCe2Session(sessionId: string, abandonedAt = new Date()): Promise<boolean> {
    return this.#database.transaction(
      'rw',
      [this.#database.ce2Sessions, this.#database.ce2State, this.#database.state],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        const activeHistory =
          ce2State.activeSessionId === null
            ? undefined
            : await this.#database.ce2Sessions.get(ce2State.activeSessionId)
        const session = activeHistory?.status === 'active' ? activeHistory.session : null
        if (session?.id !== sessionId) return false
        await this.#database.ce2Sessions.put({
          abandonedAt,
          completedAt: null,
          id: sessionId,
          session,
          status: 'abandoned',
          updatedAt: abandonedAt,
        })
        const nextCe2: Ce2StateRecord = { ...ce2State, activeSessionId: null }
        await this.#database.ce2State.put(nextCe2)
        const base = current ?? {
          activeSession: null,
          completedSessions: 0,
          id: 'current' as const,
          snapshot: LearningEngine.emptySnapshot(),
        }
        await this.#database.state.put({
          ...base,
          ce2ActiveSession: null,
          ce2ContentVersion: nextCe2.contentVersion,
          ce2Preferences: nextCe2.preferences,
          ce2Snapshot: nextCe2.snapshot,
          completedSessions: base.completedSessions,
          id: 'current',
          snapshot: base.snapshot,
        })
        return true
      },
    )
  }

  async completeCe2Session(
    input: Readonly<{
      completedAt: Date
      sessionId: string
      snapshot: Ce2LearningSnapshot
    }>,
  ): Promise<SessionCompletion | null> {
    return this.#database.transaction(
      'rw',
      [
        this.#database.ce2Attempts,
        this.#database.ce2Sessions,
        this.#database.ce2State,
        this.#database.state,
      ],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        const base = current ?? {
          activeSession: null,
          completedSessions: 0,
          id: 'current' as const,
          snapshot: LearningEngine.emptySnapshot(),
        }
        const previous = decodeSessionCompletion(base.lastCompletion)
        if (previous?.sessionId === input.sessionId) return previous
        const history =
          ce2State.activeSessionId === null
            ? undefined
            : await this.#database.ce2Sessions.get(ce2State.activeSessionId)
        const session = history?.status === 'active' ? history.session : null
        if (
          session?.id !== input.sessionId ||
          session.currentIndex < session.questions.length ||
          session.lastResult !== null
        ) {
          return null
        }
        const attempts = (
          await this.#database.ce2Attempts
            .where('sessionId')
            .equals(input.sessionId)
            .sortBy('sequence')
        ).map(decodeCe2Attempt)
        const finalAttempt = attempts[attempts.length - 1]
        if (finalAttempt?.sequence !== session.questions.length - 1) {
          return null
        }
        const currentGardenRewards = gardenRewardLedgerFor(base)
        const gardenRewards = LearningEngine.deriveGardenRewardLedger({
          completions: [
            {
              learningDayKey: finalAttempt.learningDayKey,
              sessionKind:
                finalAttempt.sessionKind === 'daily-watering' ? 'daily-watering' : 'extra-practice',
            },
          ],
          gardenBloomCount: currentGardenRewards.gardenBloomCount,
          rewardedDayKeys: currentGardenRewards.rewardedDayKeys,
        })
        const completion: SessionCompletion = {
          bloomNumber: gardenRewards.gardenBloomCount,
          ce2Module: finalAttempt.question.module,
          ce2Skill: finalAttempt.question.skill,
          completedAt: input.completedAt,
          correctAnswers: attempts.filter(({ evaluation }) => evaluation.status === 'correct')
            .length,
          finalAnswer: 0,
          finalCorrect: finalAttempt.evaluation.status === 'correct',
          gardenBloomEarned: gardenRewards.gardenBloomsEarned === 1,
          learningInsight: null,
          learningDayKey: finalAttempt.learningDayKey,
          sessionId: input.sessionId,
          sessionKind: session.kind === 'daily-watering' ? 'daily-watering' : 'extra-practice',
          totalAnswers: attempts.length,
        }
        await this.#database.ce2Sessions.put({
          abandonedAt: null,
          completedAt: input.completedAt,
          id: session.id,
          session,
          status: 'completed',
          updatedAt: input.completedAt,
        })
        const nextCe2: Ce2StateRecord = {
          ...ce2State,
          activeSessionId: null,
          snapshot: input.snapshot,
        }
        await this.#database.ce2State.put(nextCe2)
        await this.#database.state.put({
          ...base,
          ce2ActiveSession: null,
          ce2ContentVersion: nextCe2.contentVersion,
          ce2Preferences: nextCe2.preferences,
          ce2Snapshot: input.snapshot,
          completedSessions: base.completedSessions + 1,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          lastCompletion: completion,
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
        })
        return completion
      },
    )
  }

  async ce2SessionHistory(): Promise<ReadonlyArray<Ce2SessionHistoryRecord>> {
    return this.#database.ce2Sessions.orderBy('updatedAt').reverse().toArray()
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
          ...current,
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
    await this.#database.transaction(
      'rw',
      [
        this.#database.attempts,
        this.#database.ce2Sessions,
        this.#database.ce2State,
        this.#database.outbox,
        this.#database.state,
      ],
      async () => {
        const stored = decodeStateRecord(await this.#database.state.get('current'))
        const base: StateRecord = stored ?? {
          activeSession: null,
          completedSessions: 0,
          id: 'current',
          snapshot: LearningEngine.emptySnapshot(),
        }
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(stored)
        const history =
          ce2State.activeSessionId === null
            ? undefined
            : await this.#database.ce2Sessions.get(ce2State.activeSessionId)
        const ce2ActiveSession = history?.status === 'active' ? history.session : null
        const pending = await this.#database.outbox.toArray()
        const pendingAttempts = (
          await this.#database.attempts.bulkGet(pending.map(({ attemptId }) => attemptId))
        )
          .filter((attempt) => attempt !== undefined)
          .map(decodeAttemptEvent)
        const mergedSnapshot = LearningEngine.reduce({ attempts: pendingAttempts, snapshot })
        const localGardenRewards = gardenRewardLedgerFor(base)
        const serverGardenRewards = LearningEngine.deriveGardenRewardLedger({
          completions: [],
          gardenBloomCount: serverState?.gardenBloomCount,
          rewardedDayKeys: serverState?.rewardedDayKeys ?? [],
        })
        const gardenRewards = LearningEngine.mergeGardenRewardLedgers({
          ledgers: [localGardenRewards, serverGardenRewards],
        })
        await this.#database.ce2State.put({
          ...ce2State,
          activeSessionId: ce2ActiveSession?.id ?? null,
        })
        await this.#database.state.put({
          ...base,
          activeSession: ce2ActiveSession === null ? base.activeSession : null,
          ce2ActiveSession,
          ce2ContentVersion: ce2State.contentVersion,
          ce2Preferences: ce2State.preferences,
          ce2Snapshot: ce2State.snapshot,
          completedSessions: Math.max(base.completedSessions, serverState?.completedSessions ?? 0),
          gardenBloomCount: gardenRewards.gardenBloomCount,
          gardenCollection: serverState?.gardenCollection ?? base.gardenCollection,
          id: 'current',
          practiceDayKeys: [
            ...new Set([...(base.practiceDayKeys ?? []), ...(serverState?.practiceDayKeys ?? [])]),
          ],
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          sessionStartSnapshot:
            base.sessionStartSnapshot ?? (base.activeSession === null ? null : base.snapshot),
          snapshot: mergedSnapshot,
        })
      },
    )
  }

  async replaceCe2State(
    input: Readonly<{
      ce2ContentVersion: typeof CE2_CONTENT_VERSION
      ce2Preferences: Ce2Preferences
      ce2Snapshot: Ce2LearningSnapshot
    }>,
  ): Promise<void> {
    await this.#database.transaction(
      'rw',
      [
        this.#database.ce2Attempts,
        this.#database.ce2Outbox,
        this.#database.ce2State,
        this.#database.state,
      ],
      async () => {
        const current = decodeStateRecord(await this.#database.state.get('current'))
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(current)
        const pendingRecords = await this.#database.ce2Outbox
          .where('kind')
          .equals('attempt')
          .toArray()
        const pendingAttempts = (
          await this.#database.ce2Attempts.bulkGet(pendingRecords.map(({ eventId }) => eventId))
        )
          .filter((attempt) => attempt !== undefined)
          .map(decodeCe2Attempt)
        const snapshot = Ce2Engine.reduce({
          attempts: pendingAttempts,
          snapshot: input.ce2Snapshot,
        })
        const preferences = mergeCe2Preferences(input.ce2Preferences, ce2State.preferences)
        const nextCe2: Ce2StateRecord = {
          ...ce2State,
          contentVersion: input.ce2ContentVersion,
          preferences,
          snapshot,
        }
        await this.#database.ce2State.put(nextCe2)
        const gardenRewards = gardenRewardLedgerFor(current)
        await this.#database.state.put({
          ...current,
          activeSession: current?.activeSession ?? null,
          ce2ContentVersion: input.ce2ContentVersion,
          ce2Preferences: preferences,
          ce2Snapshot: snapshot,
          completedSessions: current?.completedSessions ?? 0,
          gardenBloomCount: gardenRewards.gardenBloomCount,
          id: 'current',
          rewardedDayKeys: gardenRewards.rewardedDayKeys,
          snapshot: current?.snapshot ?? LearningEngine.emptySnapshot(),
        })
      },
    )
  }

  async markGardenIntroductionSeen(): Promise<void> {
    await this.#database.transaction(
      'rw',
      [this.#database.ce2Sessions, this.#database.ce2State, this.#database.state],
      async () => {
        const stored = decodeStateRecord(await this.#database.state.get('current'))
        const base: StateRecord = stored ?? {
          activeSession: null,
          completedSessions: 0,
          id: 'current',
          snapshot: LearningEngine.emptySnapshot(),
        }
        const ce2State =
          decodeCe2StateRecord(await this.#database.ce2State.get('ce2')) ??
          ce2StateFromLegacy(stored)
        const history =
          ce2State.activeSessionId === null
            ? undefined
            : await this.#database.ce2Sessions.get(ce2State.activeSessionId)
        const ce2ActiveSession = history?.status === 'active' ? history.session : null
        await this.#database.ce2State.put({
          ...ce2State,
          activeSessionId: ce2ActiveSession?.id ?? null,
        })
        await this.#database.state.put({
          ...base,
          activeSession: ce2ActiveSession === null ? base.activeSession : null,
          ce2ActiveSession,
          ce2ContentVersion: ce2State.contentVersion,
          ce2Preferences: ce2State.preferences,
          ce2Snapshot: ce2State.snapshot,
          gardenCollection: {
            ...(base.gardenCollection ?? defaultGardenCollection()),
            introductionSeen: true,
          },
          id: 'current',
        })
      },
    )
  }
}

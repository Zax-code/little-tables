import type { AttemptEvent, LearningSnapshot, PracticeSession } from '@little-tables/domain'
import Dexie, { type EntityTable } from 'dexie'
import { Data, Either, Schema } from 'effect'

type StateRecord = Readonly<{
  activeSession: PracticeSession | null
  completedSessions: number
  id: 'current'
  lastCompletion?: SessionCompletion | null
  practiceDayKeys?: ReadonlyArray<string>
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
  lastCompletion: SessionCompletion | null
  practiceDayKeys: ReadonlyArray<string>
  snapshot: LearningSnapshot
}>

export type SessionCompletion = Readonly<{
  bloomNumber: number
  completedAt: Date
  correctAnswers: number
  finalAnswer: number
  finalCorrect: boolean
  sessionId: string
  totalAnswers: number
}>

export class InvalidStoredCompletionError extends Data.TaggedError('InvalidStoredCompletionError')<{
  cause: unknown
}> {}

const SessionCompletionSchema = Schema.Struct({
  bloomNumber: Schema.Positive.pipe(Schema.int()),
  completedAt: Schema.ValidDateFromSelf,
  correctAnswers: Schema.NonNegativeInt,
  finalAnswer: Schema.NonNegativeInt,
  finalCorrect: Schema.Boolean,
  sessionId: Schema.NonEmptyString,
  totalAnswers: Schema.Positive.pipe(Schema.int()),
})

const decodeSessionCompletion = (value: unknown): SessionCompletion | null => {
  if (value === null || value === undefined) return null
  const decoded = Schema.decodeUnknownEither(SessionCompletionSchema)(value)
  if (Either.isRight(decoded)) return decoded.right
  throw new InvalidStoredCompletionError({ cause: decoded.left })
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
    const state = await this.#database.state.get('current')
    return state === undefined
      ? {
          activeSession: null,
          completedSessions: 0,
          lastCompletion: null,
          practiceDayKeys: [],
          snapshot: { algorithmVersion: '1', facts: {}, processedEventIds: [] },
        }
      : {
          ...state,
          lastCompletion: decodeSessionCompletion(state.lastCompletion),
          practiceDayKeys: state.practiceDayKeys ?? [],
        }
  }

  async commitAnswer({ attempt, session, snapshot }: CommitAnswerInput): Promise<void> {
    await this.#database.transaction(
      'rw',
      [this.#database.attempts, this.#database.outbox, this.#database.state],
      async () => {
        const current = await this.#database.state.get('current')
        await this.#database.attempts.put(attempt)
        await this.#database.outbox.put({ attemptId: attempt.eventId, createdAt: new Date() })
        await this.#database.state.put({
          activeSession: session,
          completedSessions: current?.completedSessions ?? 0,
          id: 'current',
          lastCompletion: decodeSessionCompletion(current?.lastCompletion),
          practiceDayKeys: [
            ...new Set([
              ...(current?.practiceDayKeys ?? []),
              attempt.answeredAt.toISOString().slice(0, 10),
            ]),
          ],
          snapshot,
        })
      },
    )
  }

  async startSession(session: PracticeSession, snapshot: LearningSnapshot): Promise<void> {
    const current = await this.#database.state.get('current')
    await this.#database.state.put({
      activeSession: session,
      completedSessions: current?.completedSessions ?? 0,
      id: 'current',
      lastCompletion: decodeSessionCompletion(current?.lastCompletion),
      practiceDayKeys: current?.practiceDayKeys ?? [],
      snapshot,
    })
  }

  async pendingBatch(limit: number): Promise<SyncBatch> {
    const outbox = await this.#database.outbox.orderBy('createdAt').limit(limit).toArray()
    const attempts = await this.#database.attempts.bulkGet(outbox.map((record) => record.attemptId))
    return { attempts: attempts.filter((attempt) => attempt !== undefined) }
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
        const current = await this.#database.state.get('current')
        if (current === undefined) return null
        const previousCompletion = decodeSessionCompletion(current.lastCompletion)
        if (previousCompletion?.sessionId === sessionId) return previousCompletion

        const session = current.activeSession
        if (session === null) return null
        if (session.id !== sessionId || session.currentIndex < session.questions.length) {
          return null
        }

        const finalQuestion = session.questions[session.questions.length - 1]
        if (finalQuestion === undefined) return null
        const attempts = await this.#database.attempts
          .where('sessionId')
          .equals(sessionId)
          .sortBy('sequence')
        const finalAttempt = attempts[attempts.length - 1]
        if (finalAttempt === undefined) return null

        const completedSessions = current.completedSessions + 1
        const completion: SessionCompletion = {
          bloomNumber: completedSessions,
          completedAt,
          correctAnswers: attempts.filter(({ correct }) => correct).length,
          finalAnswer: finalQuestion.left * finalQuestion.right,
          finalCorrect: finalAttempt.correct,
          sessionId,
          totalAnswers: attempts.length,
        }
        await this.#database.state.put({
          activeSession: null,
          completedSessions,
          id: 'current',
          lastCompletion: completion,
          practiceDayKeys: current.practiceDayKeys ?? [],
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
      practiceDayKeys: ReadonlyArray<string>
    }>,
  ): Promise<void> {
    const current = await this.load()
    await this.#database.state.put({
      ...current,
      completedSessions: Math.max(current.completedSessions, serverState?.completedSessions ?? 0),
      id: 'current',
      practiceDayKeys: [
        ...new Set([...current.practiceDayKeys, ...(serverState?.practiceDayKeys ?? [])]),
      ],
      snapshot,
    })
  }
}

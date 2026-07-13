import type { AttemptEvent, LearningSnapshot, PracticeSession } from '@little-tables/domain'
import Dexie, { type EntityTable } from 'dexie'

type StateRecord = Readonly<{
  activeSession: PracticeSession | null
  completedSessions: number
  id: 'current'
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
  practiceDayKeys: ReadonlyArray<string>
  snapshot: LearningSnapshot
}>

export type CommitAnswerInput = Readonly<{
  attempt: AttemptEvent
  session: PracticeSession
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
          practiceDayKeys: [],
          snapshot: { algorithmVersion: '1', facts: {}, processedEventIds: [] },
        }
      : { ...state, practiceDayKeys: state.practiceDayKeys ?? [] }
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

  async completeSession(snapshot: LearningSnapshot): Promise<void> {
    await this.#database.transaction('rw', this.#database.state, async () => {
      const current = await this.#database.state.get('current')
      await this.#database.state.put({
        activeSession: null,
        completedSessions: (current?.completedSessions ?? 0) + 1,
        id: 'current',
        practiceDayKeys: current?.practiceDayKeys ?? [],
        snapshot,
      })
    })
  }

  async replaceSnapshot(snapshot: LearningSnapshot): Promise<void> {
    const current = await this.load()
    await this.#database.state.put({ ...current, id: 'current', snapshot })
  }
}

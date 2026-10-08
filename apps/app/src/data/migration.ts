/**
 * Copies what the previous app kept on this device (`docs/rewrite/TECHNICAL_SPEC.md` §4.6).
 *
 * The previous app stored each child in `little-tables-v1` (the historical `lou`) or
 * `little-tables-v2:{profileId}`, with `Date` objects. Their events, unsent outbox and state are
 * copied into `little-tables-v3:{profileId}` with instants in milliseconds. The old database is
 * deleted only once the copied events have reached the server (see `sync.ts`).
 */
import type { AttemptEvent, LearningSnapshot } from '@little-tables/engine/schema'
import { AttemptEvent as AttemptEventSchema } from '@little-tables/engine/schema'
import Dexie from 'dexie'
import { Effect, Result, Schema } from 'effect'

import { LocalStore, StoreError } from './local-store.js'
import { emptyState } from './local-store.js'
import { ProfileState, SessionCompletion, type ProfileState as State } from './schema.js'

export const legacyDatabaseName = (profileId: string) =>
  profileId === 'lou' ? 'little-tables-v1' : `little-tables-v2:${profileId}`

type Raw = Record<string, unknown>

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** An instant written by the previous app: a `Date`, or already a number or an ISO string. */
export const millis = (value: unknown): number | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const decodeEvent = Schema.decodeUnknownResult(AttemptEventSchema)

export const convertLegacyEvent = (raw: unknown): AttemptEvent | null => {
  if (!isRecord(raw)) return null
  const decoded = decodeEvent({ ...raw, answeredAt: millis(raw.answeredAt) })
  return Result.isSuccess(decoded) ? decoded.success : null
}

const convertSnapshot = (raw: unknown): LearningSnapshot | null => {
  if (!isRecord(raw) || !isRecord(raw.facts)) return null
  const facts = Object.fromEntries(
    Object.entries(raw.facts).map(([key, fact]) => [
      key,
      isRecord(fact)
        ? { ...fact, dueAt: millis(fact.dueAt), lastReviewedAt: millis(fact.lastReviewedAt) }
        : fact,
    ]),
  )
  return { ...raw, facts } as unknown as LearningSnapshot
}

const convertSession = (raw: unknown): unknown => {
  if (!isRecord(raw)) return null
  return {
    ...raw,
    createdAt: millis(raw.createdAt),
    currentQuestionStartedAt: millis(raw.currentQuestionStartedAt),
    kind: raw.kind ?? 'extra-practice',
    questions: Array.isArray(raw.questions)
      ? raw.questions.map((question: unknown) =>
          isRecord(question)
            ? { ...question, operation: question.operation ?? 'multiply' }
            : question,
        )
      : [],
    timeZone: raw.timeZone ?? 'UTC',
  }
}

const decodeCompletion = Schema.decodeUnknownResult(SessionCompletion)

const convertCompletion = (raw: unknown): unknown => {
  if (!isRecord(raw)) return null
  const completedAt = millis(raw.completedAt)
  const decoded = decodeCompletion({
    bloomNumber: raw.bloomNumber,
    completedAt,
    correctAnswers: raw.correctAnswers,
    finalCorrect: raw.finalCorrect,
    finalExpected: raw.finalExpected ?? raw.finalAnswer,
    gardenBloomEarned: raw.gardenBloomEarned ?? true,
    learningDayKey:
      raw.learningDayKey ??
      (completedAt === null ? undefined : new Date(completedAt).toISOString().slice(0, 10)),
    learningInsight: raw.learningInsight ?? null,
    sessionId: raw.sessionId,
    sessionKind: raw.sessionKind ?? 'extra-practice',
    totalAnswers: raw.totalAnswers,
  })
  // A summary that cannot be read only costs the last celebration screen.
  return Result.isSuccess(decoded) ? decoded.success : null
}

const decodeState = Schema.decodeUnknownResult(ProfileState)

/** The previous app's state, or `null` when it cannot be read. */
export const convertLegacyState = (raw: unknown): State | null => {
  if (!isRecord(raw)) return null
  const snapshot = convertSnapshot(raw.snapshot)
  if (snapshot === null) return null
  const rewarded = [
    ...new Set(
      (Array.isArray(raw.rewardedDayKeys)
        ? raw.rewardedDayKeys
        : Array.isArray(raw.practiceDayKeys)
          ? raw.practiceDayKeys
          : []) as ReadonlyArray<string>,
    ),
  ].sort()
  const storedBlooms = typeof raw.gardenBloomCount === 'number' ? raw.gardenBloomCount : 0
  const decoded = decodeState({
    activeSession: raw.activeSession === null ? null : convertSession(raw.activeSession),
    completedSessions: raw.completedSessions ?? 0,
    gardenBloomCount: Math.max(Math.floor(storedBlooms), rewarded.length),
    gardenCollection: raw.gardenCollection ?? emptyState().gardenCollection,
    lastCompletion: convertCompletion(raw.lastCompletion),
    practiceDayKeys: raw.practiceDayKeys ?? [],
    rewardedDayKeys: rewarded,
    sessionStartSnapshot:
      raw.sessionStartSnapshot === undefined || raw.sessionStartSnapshot === null
        ? null
        : convertSnapshot(raw.sessionStartSnapshot),
    snapshot,
  })
  return Result.isSuccess(decoded) ? decoded.success : null
}

type LegacyContent = Readonly<{
  events: ReadonlyArray<unknown>
  pending: ReadonlyArray<string>
  state: unknown
}>

const readLegacy = (name: string) =>
  Effect.tryPromise({
    catch: (cause) => new StoreError({ cause, operation: 'read-legacy' }),
    try: async (): Promise<LegacyContent | null> => {
      if (!(await Dexie.exists(name))) return null
      const database = new Dexie(name)
      database.version(1).stores({
        attempts: '&eventId, sessionId, factKey, answeredAt',
        outbox: '&attemptId, createdAt',
        state: '&id',
      })
      try {
        await database.open()
        const events: ReadonlyArray<unknown> = await database.table('attempts').toArray()
        const outbox: ReadonlyArray<unknown> = await database
          .table('outbox')
          .orderBy('createdAt')
          .toArray()
        const state: unknown = await database.table('state').get('current')
        return {
          events,
          pending: outbox
            .map((row: unknown) => (isRecord(row) ? row.attemptId : undefined))
            .filter((id): id is string => typeof id === 'string'),
          state,
        }
      } finally {
        database.close()
      }
    },
  })

export type MigrationReport = Readonly<{
  /** Events that could not be read and were left in the old database. */
  skippedEvents: number
  migratedProfiles: ReadonlyArray<string>
}>

/** Copies each child's old database once; the copy is marked so it is never repeated. */
export const migrateLegacyDatabases = (profileIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const store = yield* LocalStore
    const migratedProfiles: string[] = []
    let skippedEvents = 0
    for (const profileId of profileIds) {
      const name = legacyDatabaseName(profileId)
      const meta = yield* store.meta(profileId)
      if (meta.legacyDatabase === name) continue
      const legacy = yield* readLegacy(name)
      if (legacy === null) continue
      const events = legacy.events.map(convertLegacyEvent)
      const readable = events.filter((event): event is AttemptEvent => event !== null)
      skippedEvents += events.length - readable.length
      const known = new Set(readable.map(({ eventId }) => eventId))
      yield* store.importLegacy(profileId, {
        events: readable,
        legacyDatabase: name,
        pending: legacy.pending.filter((eventId) => known.has(eventId)),
        skippedEvents: events.length - readable.length,
        state: convertLegacyState(legacy.state),
      })
      migratedProfiles.push(profileId)
    }
    return { migratedProfiles, skippedEvents } satisfies MigrationReport
  })

/** Deletes the old database of a child once everything copied from it has been sent. */
export const forgetLegacyDatabase = (profileId: string) =>
  Effect.gen(function* () {
    const store = yield* LocalStore
    const meta = yield* store.meta(profileId)
    if (meta.legacyDatabase === null || meta.legacySkippedEvents > 0) return false
    if ((yield* store.pendingCount(profileId)) > 0) return false
    yield* Effect.tryPromise({
      catch: (cause) => new StoreError({ cause, operation: 'delete-legacy' }),
      try: () => Dexie.delete(meta.legacyDatabase ?? ''),
    })
    return true
  })

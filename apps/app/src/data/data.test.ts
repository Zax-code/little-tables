import {
  ApiClient,
  ApiError,
  type ApiClientService,
  type Bootstrap,
} from '@little-tables/api-contract'
import { Engine } from '@little-tables/engine'
import type { AttemptEvent, PracticeQuestion, PracticeSession } from '@little-tables/engine/schema'
import Dexie from 'dexie'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import { testEngine } from '../test/engine.js'
import { createDevice, keys } from './device.js'
import { LocalStore, databaseName, emptyState } from './local-store.js'
import {
  convertLegacyState,
  forgetLegacyDatabase,
  legacyDatabaseName,
  migrateLegacyDatabases,
} from './migration.js'
import {
  answerQuestion,
  completeSession,
  continueSession,
  policies,
  startSession,
  type AnswerResult,
} from './practice.js'
import { mergeServerState, synchronize } from './sync.js'

const defaultPaths = {
  enabledSkills: [],
  focusSkill: null,
  mode: 'automatic',
  subtractionMethod: 'compensation',
} as const

let profileCounter = 0
const newProfile = () => `child-${Date.now()}-${(profileCounter += 1)}`

const run = <A, E>(effect: Effect.Effect<A, E, Engine | LocalStore>) =>
  Effect.runPromise(effect.pipe(Effect.provide(Layer.merge(testEngine, LocalStore.layer))))

/** Answers every remaining question of the active session correctly. */
const answerAll = (profileId: string, session: PracticeSession) =>
  Effect.gen(function* () {
    const engine = yield* Engine
    let current: PracticeSession | null = session
    while (current !== null && current.currentIndex < current.questions.length) {
      const question: PracticeQuestion | undefined = current.questions[current.currentIndex]
      if (question === undefined) break
      const result: AnswerResult | null = yield* answerQuestion(
        profileId,
        question.exercise === undefined
          ? { selected: yield* engine.correctAnswer(question) }
          : { response: yield* engine.expectedAnswer(question.exercise) },
      )
      current = result?.session ?? null
    }
  })

describe('practice on the device', () => {
  it('records each answer atomically and blooms once per day for the daily watering', async () => {
    const profileId = newProfile()
    const outcome = await run(
      Effect.gen(function* () {
        const store = yield* LocalStore
        const session = yield* startSession(profileId, policies.daily(defaultPaths))
        if (session === null) throw new Error('no questions')
        yield* answerAll(profileId, session)
        const pendingBefore = yield* store.pendingCount(profileId)
        const completion = yield* completeSession(profileId)
        const again = yield* completeSession(profileId)
        const state = yield* store.load(profileId)
        const bonus = yield* startSession(profileId, policies.quick(defaultPaths))
        if (bonus === null) throw new Error('no questions')
        yield* answerAll(profileId, bonus)
        const bonusCompletion = yield* completeSession(profileId)
        return { again, bonusCompletion, completion, pendingBefore, session, state }
      }),
    )
    expect(outcome.pendingBefore).toBe(outcome.session.questions.length)
    expect(outcome.completion).toMatchObject({
      bloomNumber: 1,
      correctAnswers: outcome.session.questions.length,
      finalCorrect: true,
      gardenBloomEarned: true,
      sessionKind: 'daily-watering',
    })
    expect(outcome.again).toEqual(outcome.completion)
    expect(outcome.state).toMatchObject({
      activeSession: null,
      completedSessions: 1,
      gardenBloomCount: 1,
    })
    expect(outcome.state.snapshot.processedEventIds).toHaveLength(outcome.session.questions.length)
    expect(outcome.bonusCompletion).toMatchObject({
      bloomNumber: 1,
      gardenBloomEarned: false,
      sessionKind: 'extra-practice',
    })
  })

  it('offers each kind of session of the previous app, within what is unlocked', async () => {
    const sessions = await run(
      Effect.forEach(
        [
          policies.table(7),
          policies.bonusTable(12),
          policies.division(),
          policies.skill(defaultPaths, 'column-addition'),
        ],
        (policy) => startSession(newProfile(), policy),
      ),
    )
    // A beginner has not unlocked the bonus packs yet: division offers nothing and 11 × 12
    // only the facts already within reach, as in the previous app.
    expect(sessions.map((session) => session?.questions.length)).toEqual([8, 2, undefined, 9])
    // A table session mostly asks that table and mixes in a few other facts.
    const sevens = sessions[0]?.questions.filter(({ factKey }) => factKey.split(':').includes('7'))
    expect(sevens?.length).toBeGreaterThanOrEqual(4)
  })
})

/** Writes a database exactly as the previous app did, with `Date` objects. */
const writeLegacy = async (
  name: string,
  attempts: ReadonlyArray<Record<string, unknown>>,
  state: unknown,
) => {
  const database = new Dexie(name)
  database.version(1).stores({
    attempts: '&eventId, sessionId, factKey, answeredAt',
    outbox: '&attemptId, createdAt',
    state: '&id',
  })
  await database.table('attempts').bulkPut([...attempts])
  await database
    .table('outbox')
    .bulkPut(
      attempts.map(({ eventId }, index) => ({ attemptId: eventId, createdAt: new Date(index) })),
    )
  if (state !== undefined) await database.table('state').put(state)
  database.close()
}

const legacyAttempt = (eventId: string, sequence: number) => ({
  answerMode: 'keypad',
  answeredAt: new Date('2026-07-16T03:30:00.000Z'),
  choices: [],
  correct: true,
  eventId,
  factKey: '7:8',
  latencyMs: 1700,
  learningDayKey: '2026-07-16',
  left: 7,
  operation: 'multiply',
  questionCount: 2,
  right: 8,
  selected: 56,
  sequence,
  sessionId: 'old-session',
  sessionKind: 'daily-watering',
})

const legacyState = {
  activeSession: {
    createdAt: new Date('2026-07-17T08:00:00.000Z'),
    currentIndex: 1,
    currentQuestionStartedAt: new Date('2026-07-17T08:00:05.000Z'),
    id: 'resumable',
    questions: [
      { answerMode: 'keypad', choices: [], factKey: '6:7', id: 'q1', left: 6, right: 7 },
      { answerMode: 'keypad', choices: [], factKey: '6:8', id: 'q2', left: 6, right: 8 },
    ],
    seed: 42,
  },
  completedSessions: 3,
  id: 'current',
  lastCompletion: {
    bloomNumber: 2,
    completedAt: new Date('2026-07-16T03:31:00.000Z'),
    correctAnswers: 2,
    finalAnswer: 56,
    finalCorrect: true,
    sessionId: 'old-session',
    totalAnswers: 2,
  },
  practiceDayKeys: ['2026-07-15', '2026-07-16'],
  snapshot: {
    algorithmVersion: '1',
    facts: {
      '7:8': {
        correctCount: 2,
        correctStreak: 2,
        difficulty: 0.46,
        dueAt: new Date('2026-07-18T03:30:00.000Z'),
        lapseCount: 0,
        lastReviewedAt: new Date('2026-07-16T03:30:00.000Z'),
        latencyMs: 1700,
        recallDayKeys: ['2026-07-16'],
        stabilityDays: 2,
        state: 'learning',
        successfulDayKeys: ['2026-07-16'],
      },
    },
    processedEventIds: ['old-1', 'old-2'],
  },
}

describe('answer timing', () => {
  it('starts timing the next question when it is shown', async () => {
    const profileId = newProfile()
    const latency = await run(
      Effect.gen(function* () {
        const engine = yield* Engine
        const store = yield* LocalStore
        const session = yield* startSession(profileId, policies.quick(defaultPaths), 1_000)
        if (session === null) throw new Error('no questions')
        const answer = (index: number, at: number) =>
          Effect.gen(function* () {
            const question = session.questions[index]
            if (question === undefined) throw new Error('missing question')
            return yield* answerQuestion(
              profileId,
              question.exercise === undefined
                ? { selected: yield* engine.correctAnswer(question) }
                : { response: yield* engine.expectedAnswer(question.exercise) },
              at,
            )
          })
        yield* answer(0, 3_000)
        // The child reads the feedback for 20 seconds before the next question appears.
        yield* continueSession(profileId, 23_000)
        yield* answer(1, 25_000)
        const events = yield* store.sessionEvents(profileId, session.id)
        return events.map(({ latencyMs }) => latencyMs)
      }),
    )
    expect(latency).toEqual([2_000, 2_000])
  })
})

describe('moving from the previous app', () => {
  it('copies events, the unsent outbox and the state, once', async () => {
    const profileId = newProfile()
    await writeLegacy(
      legacyDatabaseName(profileId),
      [legacyAttempt('old-1', 0), legacyAttempt('old-2', 1), { eventId: 'broken' }],
      legacyState,
    )
    const result = await run(
      Effect.gen(function* () {
        const store = yield* LocalStore
        const first = yield* migrateLegacyDatabases([profileId])
        const second = yield* migrateLegacyDatabases([profileId])
        return {
          first,
          meta: yield* store.meta(profileId),
          pending: yield* store.pending(profileId, 100),
          second,
          state: yield* store.load(profileId),
        }
      }),
    )
    expect(result.first).toEqual({ migratedProfiles: [profileId], skippedEvents: 1 })
    expect(result.second.migratedProfiles).toEqual([])
    expect(result.pending.map(({ eventId }) => eventId)).toEqual(['old-1', 'old-2'])
    expect(result.pending[0]?.answeredAt).toBe(Date.parse('2026-07-16T03:30:00.000Z'))
    expect(result.state.completedSessions).toBe(3)
    expect(result.state.gardenBloomCount).toBe(2)
    expect(result.state.rewardedDayKeys).toEqual(['2026-07-15', '2026-07-16'])
    expect(result.state.activeSession).toMatchObject({ kind: 'extra-practice', timeZone: 'UTC' })
    expect(result.state.activeSession?.questions[0]?.operation).toBe('multiply')
    expect(result.state.snapshot.facts['7:8']?.dueAt).toBe(Date.parse('2026-07-18T03:30:00.000Z'))
    expect(result.state.lastCompletion).toMatchObject({
      finalExpected: 56,
      sessionKind: 'extra-practice',
    })
    expect(result.meta).toMatchObject({
      legacyDatabase: legacyDatabaseName(profileId),
      legacySkippedEvents: 1,
    })
  })

  it('deletes the old database only after a complete copy has been sent', async () => {
    const profileId = newProfile()
    const name = legacyDatabaseName(profileId)
    await writeLegacy(name, [legacyAttempt('sent-1', 0)], undefined)
    const outcome = await run(
      Effect.gen(function* () {
        const store = yield* LocalStore
        yield* migrateLegacyDatabases([profileId])
        const whilePending = yield* forgetLegacyDatabase(profileId)
        yield* store.acknowledge(profileId, ['sent-1'], [])
        const afterSync = yield* forgetLegacyDatabase(profileId)
        return { afterSync, whilePending }
      }),
    )
    expect(outcome).toEqual({ afterSync: true, whilePending: false })
    expect(await Dexie.exists(name)).toBe(false)
  })

  it('names the historical profile database like the previous app', () => {
    expect(legacyDatabaseName('lou')).toBe('little-tables-v1')
    expect(legacyDatabaseName('abc')).toBe('little-tables-v2:abc')
    expect(databaseName('abc')).toBe('little-tables-v3:abc')
    expect(convertLegacyState({ snapshot: 'nope' })).toBeNull()
  })
})

const bootstrapFor = (profileId: string, overrides: Partial<Bootstrap> = {}): Bootstrap => ({
  completedSessions: 5,
  gardenBloomCount: 4,
  gardenCollection: { ...emptyState().gardenCollection, awardedFlowerIds: ['rose-lotus'] },
  practiceDayKeys: ['2026-07-01'],
  profile: {
    avatarId: 'sprout',
    id: profileId,
    learningPaths: defaultPaths,
    name: 'Léa',
    reminderMinute: 1080,
  },
  rewardedDayKeys: ['2026-07-01', '2026-07-02'],
  rewards: [],
  snapshot: { algorithmVersion: '1', facts: {}, processedEventIds: ['server'] },
  ...overrides,
})

/** A server that records synced events and answers with `bootstrapFor`. */
const fakeServer = (
  options: Readonly<{ forbidden?: ReadonlyArray<string>; signedOut?: boolean }> = {},
) => {
  const received: Array<Readonly<{ events: ReadonlyArray<AttemptEvent>; profileId: string }>> = []
  const refusal = (profileId: string) =>
    options.signedOut === true
      ? Effect.fail(new ApiError({ code: 'unauthorized', message: '', status: 401 }))
      : options.forbidden?.includes(profileId) === true
        ? Effect.fail(new ApiError({ code: 'profile_forbidden', message: '', status: 403 }))
        : null
  const service = {
    bootstrap: (profileId: string) => refusal(profileId) ?? Effect.succeed(bootstrapFor(profileId)),
    introductionSeen: () => Effect.succeed({ introductionSeen: true as const }),
    refresh: () =>
      options.signedOut === true
        ? Effect.fail(new ApiError({ code: 'unauthorized', message: '', status: 401 }))
        : Effect.succeed({ sessionExpiresAt: 99, status: 'renewed' as const }),
    sync: (profileId: string, events: ReadonlyArray<AttemptEvent>) =>
      refusal(profileId) ??
      Effect.sync(() => {
        received.push({ events, profileId })
        return {
          accepted: events.slice(1).map(({ eventId }) => eventId),
          duplicates: [],
          rejected: events.slice(0, 1).map(({ eventId }) => ({
            eventId,
            reason: 'duplicate_sequence' as const,
          })),
        }
      }),
  } as unknown as ApiClientService
  return { layer: Layer.succeed(ApiClient, service), received }
}

const runWith = <A, E>(
  server: ReturnType<typeof fakeServer>,
  effect: Effect.Effect<A, E, ApiClient | Engine | LocalStore>,
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(Layer.mergeAll(testEngine, LocalStore.layer, server.layer))),
  )

describe('synchronisation', () => {
  it('sends every outbox, then merges the active child without losing local progress', async () => {
    const [active, sibling] = [newProfile(), newProfile()]
    const server = fakeServer()
    const result = await runWith(
      server,
      Effect.gen(function* () {
        const store = yield* LocalStore
        for (const profileId of [active, sibling]) {
          const session = yield* startSession(profileId, policies.quick(defaultPaths))
          if (session !== null) yield* answerAll(profileId, session)
        }
        yield* store.update(active, (state) => ({
          state: {
            ...state,
            gardenCollection: { ...state.gardenCollection, introductionSeen: true },
            practiceDayKeys: ['2026-07-09'],
            rewardedDayKeys: ['2026-07-03'],
          },
        }))
        const outcome = yield* synchronize({
          activeProfileId: active,
          profileIds: [active, sibling],
        })
        return {
          meta: yield* store.meta(active),
          outcome,
          pending: (yield* store.pendingCount(active)) + (yield* store.pendingCount(sibling)),
          state: yield* store.load(active),
        }
      }),
    )
    expect(server.received.map(({ profileId }) => profileId)).toEqual([active, sibling])
    expect(result.pending).toBe(0)
    expect(result.meta.rejectedCount).toBe(1)
    expect(result.outcome).toEqual({ gone: [], merged: true, sessionExpiresAt: 99 })
    expect(result.state.snapshot.processedEventIds).toEqual(['server'])
    expect(result.state.rewardedDayKeys).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
    expect(result.state.gardenBloomCount).toBe(4)
    expect(result.state.practiceDayKeys).toEqual(['2026-07-01', '2026-07-09'])
    expect(result.state.gardenCollection.introductionSeen).toBe(true)
  })

  it('reports children who left the family and sign-outs', async () => {
    const [active, removed] = [newProfile(), newProfile()]
    const forbidding = fakeServer({ forbidden: [removed] })
    const outcome = await runWith(
      forbidding,
      Effect.gen(function* () {
        const session = yield* startSession(removed, policies.quick(defaultPaths))
        if (session !== null) yield* answerAll(removed, session)
        return yield* synchronize({ activeProfileId: active, profileIds: [active, removed] })
      }),
    )
    expect(outcome.gone).toEqual([removed])
    const signedOut = await runWith(
      fakeServer({ signedOut: true }),
      synchronize({ activeProfileId: active, profileIds: [active] }).pipe(Effect.flip),
    )
    expect(signedOut._tag).toBe('SignedOut')
  })

  it('keeps the session in progress and never lowers counts', () => {
    const local = {
      ...emptyState(),
      completedSessions: 9,
      gardenBloomCount: 7,
      rewardedDayKeys: ['a', 'b'],
    }
    const merged = mergeServerState(
      local,
      bootstrapFor('x', { completedSessions: 2, gardenBloomCount: 1 }),
    )
    expect(merged.completedSessions).toBe(9)
    expect(merged.gardenBloomCount).toBe(7)
  })
})

/** A `localStorage` double. */
const memoryStorage = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  }
}

describe('device settings', () => {
  it('takes over the previous app settings and keeps them for a rollback', () => {
    const storage = memoryStorage({
      'little-tables-active-child-v1': ' zoe ',
      'little-tables-family-profiles-v1': JSON.stringify([
        { avatarId: 'sprout', id: 'zoe', name: 'Zoé' },
      ]),
      'little-tables-google-session-v1': JSON.stringify({
        displayName: 'léa',
        expiresAt: 5000,
        nameChoiceRequired: true,
      }),
      'little-tables:locale': 'zh-Hans',
      'little-tables:sound': 'off',
    })
    const device = createDevice(storage)
    device.adoptLegacyKeys(1000)
    expect(device.preferences()).toMatchObject({ language: 'zh-Hans', sound: false })
    expect(device.activeProfileId()).toBe('zoe')
    expect(device.authGrant(1000)).toMatchObject({ expiresAt: 5000, onboardingRequired: true })
    expect(device.authGrant(6000)).toBeNull()
    expect(device.legacyProfileIds()).toEqual(['lou', 'zoe'])
    expect(device.profiles()).toEqual([
      {
        avatarId: 'sprout',
        id: 'zoe',
        learningPaths: {
          enabledSkills: [],
          focusSkill: null,
          mode: 'automatic',
          subtractionMethod: 'compensation',
        },
        name: 'Zoé',
        reminderMinute: 1080,
      },
    ])
    expect(storage.values.has('little-tables:locale')).toBe(true)
  })

  it('falls back to defaults on unreadable values and forgets the family at sign-out', () => {
    const storage = memoryStorage({ [keys.preferences]: '{"language":"de"}' })
    const device = createDevice(storage)
    expect(device.preferences().language).toBe('fr')
    device.setActiveProfileId('lou')
    device.markCardSeen('paths')
    device.markCardSeen('paths')
    expect(device.seenCards()).toEqual(['paths'])
    device.forgetFamily()
    expect(device.activeProfileId()).toBeNull()
    expect(device.seenCards()).toEqual([])
    expect(createDevice(null).preferences().language).toBe('fr')
  })
})

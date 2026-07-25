import 'fake-indexeddb/auto'

import { LearningEngine } from '@little-tables/domain'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import {
  IndexedDbPracticeStore,
  InvalidStoredAttemptError,
  InvalidStoredCompletionError,
  InvalidStoredStateError,
} from './practice-store.js'

describe('IndexedDbPracticeStore', () => {
  const databases: string[] = []

  const finishDailyWatering = async (
    store: IndexedDbPracticeStore,
    input: Readonly<{
      at: Date
      seed: number
      snapshot: ReturnType<typeof LearningEngine.emptySnapshot>
    }>,
  ) => {
    let snapshot = input.snapshot
    let session = LearningEngine.createSession({
      now: input.at,
      policy: { kind: 'daily-watering' },
      seed: input.seed,
      snapshot,
      timeZone: 'America/New_York',
    })
    await store.startSession(session, snapshot)

    while (session.currentIndex < session.questions.length) {
      const question = session.questions[session.currentIndex]
      if (question === undefined) throw new Error('Expected a daily watering question')
      const result = LearningEngine.answer({
        answeredAt: new Date(input.at.getTime() + (session.currentIndex + 1) * 1_000),
        eventId: `daily-${input.seed}-${session.currentIndex}`,
        selected: LearningEngine.correctAnswer(question),
        session,
      })
      snapshot = LearningEngine.reduce({ attempts: [result.event], snapshot })
      session = result.session
      await store.commitAnswer({ attempt: result.event, session, snapshot })
    }

    const completion = await store.completeSession({
      completedAt: new Date(input.at.getTime() + 30_000),
      sessionId: session.id,
      snapshot,
    })
    if (completion === null) throw new Error('Expected a completed daily watering')
    return { completion, snapshot }
  }

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((name) => IndexedDbPracticeStore.delete(name)))
  })

  it('earns at most one garden bloom for repeated watering on the same learner day', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const initial = LearningEngine.emptySnapshot()
    const first = await finishDailyWatering(store, {
      at: new Date('2026-07-13T01:00:00.000Z'),
      seed: 100,
      snapshot: initial,
    })
    const repeated = await finishDailyWatering(store, {
      at: new Date('2026-07-13T02:00:00.000Z'),
      seed: 101,
      snapshot: first.snapshot,
    })

    expect(first.completion).toMatchObject({
      bloomNumber: 1,
      gardenBloomEarned: true,
      learningDayKey: '2026-07-12',
    })
    expect(repeated.completion).toMatchObject({
      bloomNumber: 1,
      gardenBloomEarned: false,
      learningDayKey: '2026-07-12',
    })
    expect(await store.load()).toMatchObject({
      completedSessions: 2,
      gardenBloomCount: 1,
      rewardedDayKeys: ['2026-07-12'],
    })
    store.close()
  })

  it('caches the server-authoritative personalized collection for offline use', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const flowerOrder = [...LearningEngine.gardenFlowerIds].reverse()

    await store.replaceSnapshot(LearningEngine.emptySnapshot(), {
      completedSessions: 3,
      gardenBloomCount: 3,
      gardenCollection: {
        awardedFlowerIds: [flowerOrder[0] ?? 'blue-wisteria'],
        bloomsPerFlower: 3,
        catalogVersion: '1',
        flowerOrder,
        introductionSeen: false,
      },
      practiceDayKeys: ['2026-07-23', '2026-07-24', '2026-07-25'],
      rewardedDayKeys: ['2026-07-23', '2026-07-24', '2026-07-25'],
    })
    await store.markGardenIntroductionSeen()

    const offline = await store.load()
    expect(offline.gardenCollection).toEqual({
      awardedFlowerIds: [flowerOrder[0]],
      bloomsPerFlower: 3,
      catalogVersion: '1',
      flowerOrder,
      introductionSeen: true,
    })
    expect(offline.gardenBloomCount).toBe(3)
    store.close()
  })

  it('persists an answer and its outbox entry across store instances until acknowledged', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 1,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected question')
    const result = LearningEngine.answer({
      answeredAt: new Date('2026-07-12T12:00:01.000Z'),
      eventId: 'attempt-persisted',
      selected: question.left * question.right,
      session,
    })
    const snapshot = LearningEngine.reduce({
      attempts: [result.event],
      snapshot: LearningEngine.emptySnapshot(),
    })

    const first = new IndexedDbPracticeStore(databaseName)
    await first.commitAnswer({ attempt: result.event, session: result.session, snapshot })
    first.close()

    const reopened = new IndexedDbPracticeStore(databaseName)
    expect((await reopened.load()).snapshot).toEqual(snapshot)
    expect((await reopened.load()).practiceDayKeys).toEqual(['2026-07-12'])
    expect((await reopened.pendingBatch(10)).attempts.map((attempt) => attempt.eventId)).toEqual([
      'attempt-persisted',
    ])

    await reopened.acknowledge(['attempt-persisted'])
    expect((await reopened.pendingBatch(10)).attempts).toEqual([])
    reopened.close()
  })

  it('persists an active session and increments completed sessions without losing mastery', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const snapshot = LearningEngine.emptySnapshot()
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 3,
      snapshot,
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected question')
    const answer = LearningEngine.answer({
      answeredAt: new Date('2026-07-12T12:00:01.000Z'),
      eventId: 'attempt-before-sync',
      selected: question.left * question.right,
      session,
    })
    const learnedSnapshot = LearningEngine.reduce({ attempts: [answer.event], snapshot })

    await store.startSession(session, snapshot)
    expect((await store.load()).activeSession?.id).toBe(session.id)
    await store.commitAnswer({
      attempt: answer.event,
      session: answer.session,
      snapshot: learnedSnapshot,
    })
    const completion = await store.completeSession({
      completedAt: new Date('2026-07-12T12:00:02.000Z'),
      sessionId: session.id,
      snapshot: learnedSnapshot,
    })
    expect(completion).toMatchObject({
      bloomNumber: 0,
      correctAnswers: 1,
      finalAnswer: question.left * question.right,
      finalCorrect: true,
      gardenBloomEarned: false,
      learningInsight: { count: 1, kind: 'facts-practised' },
      sessionId: session.id,
      sessionKind: 'extra-practice',
      totalAnswers: 1,
    })
    const replacement = { ...learnedSnapshot, processedEventIds: ['from-server'] }
    await store.replaceSnapshot(replacement)

    expect(await store.load()).toMatchObject({
      activeSession: null,
      completedSessions: 1,
      lastCompletion: completion,
      snapshot: replacement,
    })
    store.close()
  })

  it('stores a completion summary and preserves it through later session writes and sync', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const initialSnapshot = LearningEngine.emptySnapshot()
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 4,
      snapshot: initialSnapshot,
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected question')
    const answer = LearningEngine.answer({
      answeredAt: new Date('2026-07-12T12:00:01.000Z'),
      eventId: 'attempt-completes-session',
      selected: question.left * question.right + 1,
      session,
    })
    const snapshot = LearningEngine.reduce({
      attempts: [answer.event],
      snapshot: initialSnapshot,
    })
    const completedAt = new Date('2026-07-12T12:00:02.000Z')

    await store.startSession(session, initialSnapshot)
    await store.commitAnswer({ attempt: answer.event, session: answer.session, snapshot })

    const completion = await store.completeSession({ completedAt, sessionId: session.id, snapshot })

    expect(completion).toEqual({
      bloomNumber: 0,
      completedAt,
      correctAnswers: 0,
      finalAnswer: question.left * question.right,
      finalCorrect: false,
      gardenBloomEarned: false,
      learningInsight: null,
      learningDayKey: '2026-07-12',
      sessionId: session.id,
      sessionKind: 'extra-practice',
      totalAnswers: 1,
    })
    expect(await store.load()).toMatchObject({
      activeSession: null,
      completedSessions: 1,
      lastCompletion: completion,
      snapshot,
    })

    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-13T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 5,
      snapshot,
    })
    const nextQuestion = nextSession.questions[0]
    if (nextQuestion === undefined) throw new Error('Expected question')
    await store.startSession(nextSession, snapshot)
    expect((await store.load()).lastCompletion).toEqual(completion)

    const nextAnswer = LearningEngine.answer({
      answeredAt: new Date('2026-07-13T12:00:01.000Z'),
      eventId: 'attempt-after-completion',
      selected: nextQuestion.left * nextQuestion.right,
      session: nextSession,
    })
    const nextSnapshot = LearningEngine.reduce({ attempts: [nextAnswer.event], snapshot })
    await store.commitAnswer({
      attempt: nextAnswer.event,
      session: nextAnswer.session,
      snapshot: nextSnapshot,
    })
    expect((await store.load()).lastCompletion).toEqual(completion)

    const syncedSnapshot = { ...nextSnapshot, processedEventIds: ['from-server'] }
    await store.replaceSnapshot(syncedSnapshot)
    expect((await store.load()).lastCompletion).toEqual(completion)
    store.close()
  })

  it('returns the persisted completion after reload without incrementing twice', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const initialSnapshot = LearningEngine.emptySnapshot()
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 6,
      snapshot: initialSnapshot,
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected question')
    const answer = LearningEngine.answer({
      answeredAt: new Date('2026-07-12T12:00:01.000Z'),
      eventId: 'attempt-before-reload',
      selected: question.left * question.right,
      session,
    })
    const snapshot = LearningEngine.reduce({
      attempts: [answer.event],
      snapshot: initialSnapshot,
    })
    const input = {
      completedAt: new Date('2026-07-12T12:00:02.000Z'),
      sessionId: session.id,
      snapshot,
    }

    const firstStore = new IndexedDbPracticeStore(databaseName)
    await firstStore.commitAnswer({ attempt: answer.event, session: answer.session, snapshot })
    const firstCompletion = await firstStore.completeSession(input)
    firstStore.close()

    const reopened = new IndexedDbPracticeStore(databaseName)
    const repeatedCompletion = await reopened.completeSession(input)

    expect(repeatedCompletion).toEqual(firstCompletion)
    expect(await reopened.load()).toMatchObject({
      activeSession: null,
      completedSessions: 1,
      lastCompletion: firstCompletion,
    })
    reopened.close()
  })

  it('rejects mismatched and unfinished active sessions without changing progress', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const snapshot = LearningEngine.emptySnapshot()
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 7,
      snapshot,
    })
    const completedAt = new Date('2026-07-12T12:00:02.000Z')

    expect(await store.completeSession({ completedAt, sessionId: session.id, snapshot })).toBeNull()
    await store.startSession(session, snapshot)

    expect(
      await store.completeSession({ completedAt, sessionId: 'another-session', snapshot }),
    ).toBeNull()
    expect(await store.completeSession({ completedAt, sessionId: session.id, snapshot })).toBeNull()
    expect(await store.load()).toMatchObject({
      activeSession: session,
      completedSessions: 0,
      lastCompletion: null,
      snapshot,
    })
    store.close()
  })

  it('migrates legacy garden blooms to distinct practiced days', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const snapshot = LearningEngine.emptySnapshot()
    const injector = new Dexie(databaseName)
    injector.version(1).stores({
      attempts: '&eventId, sessionId, factKey, answeredAt',
      outbox: '&attemptId, createdAt',
      state: '&id',
    })
    await injector.table('state').put({
      activeSession: null,
      completedSessions: 4,
      id: 'current',
      practiceDayKeys: ['2026-07-10', '2026-07-12'],
      snapshot,
    })
    injector.close()

    const store = new IndexedDbPracticeStore(databaseName)
    expect(await store.load()).toMatchObject({
      completedSessions: 4,
      gardenBloomCount: 2,
      rewardedDayKeys: ['2026-07-10', '2026-07-12'],
    })
    store.close()
  })

  it('normalizes an unfinished legacy multiplication session before resuming it', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const snapshot = LearningEngine.emptySnapshot()
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 55,
      snapshot,
    })
    const legacySession: Record<string, unknown> = {
      ...session,
      questions: session.questions.map((question) => {
        const legacyQuestion: Record<string, unknown> = { ...question }
        delete legacyQuestion.operation
        return legacyQuestion
      }),
    }
    delete legacySession.kind
    delete legacySession.timeZone
    const injector = new Dexie(databaseName)
    injector.version(1).stores({
      attempts: '&eventId, sessionId, factKey, answeredAt',
      outbox: '&attemptId, createdAt',
      state: '&id',
    })
    await injector.table('state').put({
      activeSession: legacySession,
      completedSessions: 0,
      id: 'current',
      snapshot,
    })
    injector.close()

    const store = new IndexedDbPracticeStore(databaseName)
    const loaded = await store.load()
    expect(loaded.activeSession).toMatchObject({ kind: 'extra-practice', timeZone: 'UTC' })
    expect(loaded.activeSession?.questions[0]?.operation).toBe('multiply')
    store.close()
  })

  it('rejects malformed persisted learning state at the IndexedDB boundary', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const injector = new Dexie(databaseName)
    injector.version(1).stores({
      attempts: '&eventId, sessionId, factKey, answeredAt',
      outbox: '&attemptId, createdAt',
      state: '&id',
    })
    await injector.table('state').put({
      activeSession: null,
      completedSessions: 0,
      id: 'current',
      snapshot: { algorithmVersion: '2', facts: {}, processedEventIds: [] },
    })
    injector.close()

    const store = new IndexedDbPracticeStore(databaseName)
    await expect(store.load()).rejects.toBeInstanceOf(InvalidStoredStateError)
    store.close()
  })

  it('rejects malformed persisted attempts before syncing them', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const injector = new Dexie(databaseName)
    injector.version(1).stores({
      attempts: '&eventId, sessionId, factKey, answeredAt',
      outbox: '&attemptId, createdAt',
      state: '&id',
    })
    await injector.table('attempts').put({
      answeredAt: new Date('2026-07-16T12:00:00.000Z'),
      eventId: 'corrupt-attempt',
      factKey: '2:5',
      selected: 'ten',
      sessionId: 'corrupt-session',
    })
    await injector
      .table('outbox')
      .put({ attemptId: 'corrupt-attempt', createdAt: new Date('2026-07-16T12:00:01.000Z') })
    injector.close()

    const store = new IndexedDbPracticeStore(databaseName)
    await expect(store.pendingBatch(100)).rejects.toBeInstanceOf(InvalidStoredAttemptError)
    store.close()
  })

  it('rejects a corrupt stored completion without overwriting it during later writes', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const snapshot = LearningEngine.emptySnapshot()
    const corruptCompletion = { bloomNumber: 'not-a-number', sessionId: 'corrupt-session' }
    const injector = new Dexie(databaseName)
    injector.version(1).stores({
      attempts: '&eventId, sessionId, factKey, answeredAt',
      outbox: '&attemptId, createdAt',
      state: '&id',
    })
    await injector.table('state').put({
      activeSession: null,
      completedSessions: 3,
      id: 'current',
      lastCompletion: corruptCompletion,
      practiceDayKeys: [],
      snapshot,
    })
    injector.close()

    const store = new IndexedDbPracticeStore(databaseName)
    await expect(store.load()).rejects.toBeInstanceOf(InvalidStoredCompletionError)

    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-13T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 8,
      snapshot,
    })
    await expect(store.startSession(nextSession, snapshot)).rejects.toMatchObject({
      _tag: 'InvalidStoredCompletionError',
    })
    store.close()

    const inspector = new Dexie(databaseName)
    inspector.version(1).stores({
      attempts: '&eventId, sessionId, factKey, answeredAt',
      outbox: '&attemptId, createdAt',
      state: '&id',
    })
    const persisted: unknown = await inspector.table('state').get('current')
    expect(persisted).toMatchObject({
      activeSession: null,
      completedSessions: 3,
      lastCompletion: corruptCompletion,
    })
    inspector.close()
  })
})

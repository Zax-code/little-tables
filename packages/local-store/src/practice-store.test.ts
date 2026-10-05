import 'fake-indexeddb/auto'

import { CE2_CONTENT_VERSION, Ce2Engine, LearningEngine } from '@little-tables/domain'
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
    const replacementWithPending = {
      ...replacement,
      processedEventIds: ['from-server', 'attempt-before-sync'],
    }

    expect(await store.load()).toMatchObject({
      activeSession: null,
      completedSessions: 1,
      lastCompletion: completion,
      snapshot: replacementWithPending,
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

  it('abandons a legacy session without discarding its committed attempts or awarding a bloom', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const initial = LearningEngine.emptySnapshot()
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { kind: 'daily-watering' },
      seed: 71,
      snapshot: initial,
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected a legacy question')
    const answered = LearningEngine.answer({
      answeredAt: new Date('2026-07-12T12:00:01.000Z'),
      eventId: 'legacy-before-abandon',
      selected: LearningEngine.correctAnswer(question),
      session,
    })
    const snapshot = LearningEngine.reduce({ attempts: [answered.event], snapshot: initial })
    await store.startSession(session, initial)
    await store.commitAnswer({ attempt: answered.event, session: answered.session, snapshot })

    await expect(store.abandonSession(session.id)).resolves.toBe(true)
    expect(await store.load()).toMatchObject({
      activeSession: null,
      completedSessions: 0,
      gardenBloomCount: 0,
      rewardedDayKeys: [],
      snapshot,
    })
    expect((await store.pendingBatch(10)).attempts.map(({ eventId }) => eventId)).toEqual([
      'legacy-before-abandon',
    ])
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

  it('migrates a legacy database without losing its state or outbox', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const snapshot = LearningEngine.emptySnapshot()
    const legacySession = LearningEngine.createSession({
      now: new Date('2026-07-20T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 44,
      snapshot,
    })
    const question = legacySession.questions[0]
    if (question === undefined) throw new Error('Expected a legacy question')
    const answered = LearningEngine.answer({
      answeredAt: new Date('2026-07-20T12:00:01.000Z'),
      eventId: 'legacy-outbox-event',
      selected: LearningEngine.correctAnswer(question),
      session: legacySession,
    })
    const injector = new Dexie(databaseName)
    injector.version(1).stores({
      attempts: '&eventId, sessionId, factKey, answeredAt',
      outbox: '&attemptId, createdAt',
      state: '&id',
    })
    await injector.table('attempts').put(answered.event)
    await injector
      .table('outbox')
      .put({ attemptId: answered.event.eventId, createdAt: answered.event.answeredAt })
    await injector.table('state').put({
      activeSession: answered.session,
      completedSessions: 2,
      id: 'current',
      snapshot,
    })
    injector.close()

    const migrated = new IndexedDbPracticeStore(databaseName)
    const loaded = await migrated.load()
    expect(loaded).toMatchObject({
      activeSession: { id: legacySession.id },
      ce2ActiveSession: null,
      ce2ContentVersion: null,
      completedSessions: 2,
    })
    expect((await migrated.pendingBatch(10)).attempts.map(({ eventId }) => eventId)).toEqual([
      'legacy-outbox-event',
    ])
    migrated.close()
  })

  it('persists CE2 drafts and abandon history without awarding a bloom', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const snapshot = Ce2Engine.emptySnapshot()
    const session = Ce2Engine.createSession({
      kind: 'discovery',
      module: 'arithmetic',
      now: new Date('2026-07-21T12:00:00.000Z'),
      seed: 81,
      skill: 'A5',
      snapshot,
    })
    await store.startCe2Session(session, snapshot)
    if (session.draft === null) throw new Error('Expected a CE2 draft')
    const draft = {
      ...session.draft,
      activeElapsedMs: 4_200,
      answer: null,
      helpOpened: true,
      resultRevealed: true,
      updatedAt: new Date('2026-07-21T12:00:05.000Z'),
    }
    await expect(store.saveCe2Draft(session.id, draft)).resolves.toBe(true)
    store.close()

    const reopened = new IndexedDbPracticeStore(databaseName)
    expect((await reopened.load()).ce2ActiveSession?.draft).toMatchObject({
      activeElapsedMs: 4_200,
      helpOpened: true,
      resultRevealed: true,
    })
    await expect(reopened.abandonCe2Session(session.id)).resolves.toBe(true)
    expect(await reopened.load()).toMatchObject({
      ce2ActiveSession: null,
      gardenBloomCount: 0,
      rewardedDayKeys: [],
    })
    expect(await reopened.ce2SessionHistory()).toEqual([
      expect.objectContaining({ id: session.id, status: 'abandoned' }),
    ])
    reopened.close()
  })

  it('commits CE2 attempts and preference updates idempotently and keeps them over bootstrap', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const snapshot = Ce2Engine.emptySnapshot()
    const session = Ce2Engine.createSession({
      kind: 'extra-practice',
      module: 'fractions',
      now: new Date('2026-07-22T12:00:00.000Z'),
      seed: 12,
      skill: 'F2',
      snapshot,
    })
    await store.startCe2Session(session, snapshot)
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected a CE2 question')
    const result = Ce2Engine.answer({
      answer: question.solution,
      answeredAt: new Date('2026-07-22T12:00:02.000Z'),
      assistance: {
        guided: false,
        helpOpened: false,
        representationHints: 0,
        resultRevealed: false,
        switchedToFree: false,
      },
      eventId: 'ce2-attempt-once',
      session,
    })
    const learned = Ce2Engine.reduce({ attempts: [result.attempt], snapshot })
    await store.commitCe2Answer({
      attempt: result.attempt,
      session: result.session,
      snapshot: learned,
    })
    await store.commitCe2Answer({
      attempt: result.attempt,
      session: result.session,
      snapshot: learned,
    })
    await store.updateCe2Preferences({
      enabledModules: ['fractions'],
      eventId: 'ce2-pref-once',
      lastDailyFamily: 'fractions',
      schemaVersion: 'ce2-preference-update/v1',
      updatedAt: new Date('2026-07-22T12:00:03.000Z'),
    })
    const batch = await store.pendingCe2Batch(10)
    expect(batch.attempts.map(({ eventId }) => eventId)).toEqual(['ce2-attempt-once'])
    expect(batch.preferenceUpdates.map(({ eventId }) => eventId)).toEqual(['ce2-pref-once'])

    await store.replaceCe2State({
      ce2ContentVersion: CE2_CONTENT_VERSION,
      ce2Preferences: {
        enabledModules: ['arithmetic'],
        lastDailyFamily: 'arithmetic',
        schemaVersion: 'ce2-preferences/v1',
        updatedAt: new Date('2026-07-22T11:00:00.000Z'),
      },
      ce2Snapshot: Ce2Engine.emptySnapshot(),
    })
    const loaded = await store.load()
    expect(loaded.ce2Snapshot.processedEventIds).toContain('ce2-attempt-once')
    expect(loaded.ce2Preferences.enabledModules).toEqual(['arithmetic', 'fractions'])
    expect(loaded.ce2Preferences.lastDailyFamily).toBe('fractions')
    expect(loaded.ce2ContentVersion).toBe(CE2_CONTENT_VERSION)
    store.close()
  })

  it('serializes legacy snapshot and garden writes with a concurrent CE2 commit', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const first = new IndexedDbPracticeStore(databaseName)
    const second = new IndexedDbPracticeStore(databaseName)
    const initial = Ce2Engine.activateModule(Ce2Engine.emptySnapshot(), 'arithmetic')
    const session = Ce2Engine.createSession({
      kind: 'extra-practice',
      module: 'arithmetic',
      now: new Date('2026-07-24T12:00:00.000Z'),
      seed: 244,
      skill: 'A1',
      snapshot: initial,
    })
    await first.startCe2Session(session, initial)
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected a CE2 question')
    const result = Ce2Engine.answer({
      answer: question.solution,
      answeredAt: new Date('2026-07-24T12:00:02.000Z'),
      assistance: {
        guided: false,
        helpOpened: false,
        representationHints: 0,
        resultRevealed: false,
        switchedToFree: false,
      },
      eventId: 'ce2-interleaved-attempt',
      session,
    })
    const learned = Ce2Engine.reduce({ attempts: [result.attempt], snapshot: initial })

    await Promise.all([
      first.replaceSnapshot(LearningEngine.emptySnapshot(), {
        completedSessions: 3,
        practiceDayKeys: ['2026-07-23'],
      }),
      second.commitCe2Answer({
        attempt: result.attempt,
        session: result.session,
        snapshot: learned,
      }),
    ])
    const nextDraft = result.session.draft
    if (nextDraft === null) throw new Error('Expected the next CE2 draft')
    const editedDraft = {
      ...nextDraft,
      activeElapsedMs: 5_500,
      helpOpened: true,
      updatedAt: new Date('2026-07-24T12:00:03.000Z'),
    }
    await Promise.all([
      first.markGardenIntroductionSeen(),
      second.saveCe2Draft(session.id, editedDraft),
    ])

    const loaded = await first.load()
    expect(loaded.ce2ActiveSession).toMatchObject({
      currentIndex: 1,
      draft: { activeElapsedMs: 5_500, helpOpened: true },
      id: session.id,
    })
    expect(loaded.ce2Snapshot).toEqual(learned)
    expect(loaded.gardenCollection.introductionSeen).toBe(true)
    expect((await first.pendingCe2Batch(10)).attempts.map(({ eventId }) => eventId)).toEqual([
      'ce2-interleaved-attempt',
    ])
    first.close()
    second.close()
  })

  it('rehydrates exact CE2 state after an old client replaces state/current', async () => {
    const databaseName = `practice-${crypto.randomUUID()}`
    databases.push(databaseName)
    const store = new IndexedDbPracticeStore(databaseName)
    const initial = Ce2Engine.activateModule(Ce2Engine.emptySnapshot(), 'fractions')
    await store.replaceCe2State({
      ce2ContentVersion: CE2_CONTENT_VERSION,
      ce2Preferences: {
        enabledModules: ['fractions'],
        lastDailyFamily: 'fractions',
        schemaVersion: 'ce2-preferences/v1',
        updatedAt: new Date('2026-07-25T12:00:00.000Z'),
      },
      ce2Snapshot: initial,
    })
    const session = Ce2Engine.createSession({
      kind: 'extra-practice',
      module: 'fractions',
      now: new Date('2026-07-25T12:01:00.000Z'),
      seed: 255,
      skill: 'F2',
      snapshot: initial,
    })
    await store.startCe2Session(session, initial)
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected a CE2 question')
    const result = Ce2Engine.answer({
      answer: question.solution,
      answeredAt: new Date('2026-07-25T12:01:02.000Z'),
      assistance: {
        guided: false,
        helpOpened: true,
        representationHints: 1,
        resultRevealed: false,
        switchedToFree: false,
      },
      eventId: 'ce2-before-old-client',
      session,
    })
    const learned = Ce2Engine.reduce({ attempts: [result.attempt], snapshot: initial })
    await store.commitCe2Answer({
      attempt: result.attempt,
      session: result.session,
      snapshot: learned,
    })
    const nextDraft = result.session.draft
    if (nextDraft === null) throw new Error('Expected a persisted next draft')
    const exactDraft = {
      ...nextDraft,
      activeElapsedMs: 9_001,
      helpOpened: true,
      selectedPartIds: ['part-1'],
      updatedAt: new Date('2026-07-25T12:01:04.000Z'),
    }
    await store.saveCe2Draft(session.id, exactDraft)
    await store.updateCe2Preferences({
      enabledModules: ['fractions', 'arithmetic'],
      eventId: 'preference-before-old-client',
      lastDailyFamily: 'arithmetic',
      schemaVersion: 'ce2-preference-update/v1',
      updatedAt: new Date('2026-07-25T12:01:05.000Z'),
    })
    store.close()

    const oldClient = new Dexie(databaseName)
    oldClient.version(2).stores({
      attempts: '&eventId, sessionId, factKey, answeredAt',
      ce2Attempts: '&eventId, sessionId, answeredAt',
      ce2Outbox: '&eventId, kind, createdAt',
      ce2PreferenceUpdates: '&eventId, updatedAt',
      ce2Sessions: '&id, status, updatedAt',
      outbox: '&attemptId, createdAt',
      state: '&id',
    })
    const legacySession = LearningEngine.createSession({
      now: new Date('2026-07-25T13:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 256,
      snapshot: LearningEngine.emptySnapshot(),
    })
    await oldClient.table('state').put({
      activeSession: legacySession,
      completedSessions: 0,
      id: 'current',
      sessionStartSnapshot: LearningEngine.emptySnapshot(),
      snapshot: LearningEngine.emptySnapshot(),
    })
    oldClient.close()

    const restored = new IndexedDbPracticeStore(databaseName)
    const loaded = await restored.load()
    expect(loaded.activeSession).toBeNull()
    expect(loaded.ce2ActiveSession).toEqual({ ...result.session, draft: exactDraft })
    expect(loaded.ce2Snapshot).toEqual(learned)
    expect(loaded.ce2Preferences).toEqual({
      enabledModules: ['fractions', 'arithmetic'],
      lastDailyFamily: 'arithmetic',
      schemaVersion: 'ce2-preferences/v1',
      updatedAt: new Date('2026-07-25T12:01:05.000Z'),
    })
    expect(loaded.ce2ContentVersion).toBe(CE2_CONTENT_VERSION)
    const pending = await restored.pendingCe2Batch(10)
    expect(pending.attempts.map(({ eventId }) => eventId)).toEqual(['ce2-before-old-client'])
    expect(pending.preferenceUpdates.map(({ eventId }) => eventId)).toEqual([
      'preference-before-old-client',
    ])
    expect(await restored.ce2SessionHistory()).toContainEqual(
      expect.objectContaining({ id: session.id, status: 'active' }),
    )
    restored.close()
  })

  it('keeps CE2 preferences isolated in each profile database', async () => {
    const firstName = `practice-${crypto.randomUUID()}`
    const secondName = `practice-${crypto.randomUUID()}`
    databases.push(firstName, secondName)
    const first = new IndexedDbPracticeStore(firstName)
    const second = new IndexedDbPracticeStore(secondName)
    await first.updateCe2Preferences({
      enabledModules: ['arithmetic'],
      eventId: 'first-profile-preference',
      lastDailyFamily: 'arithmetic',
      schemaVersion: 'ce2-preference-update/v1',
      updatedAt: new Date('2026-07-23T12:00:00.000Z'),
    })
    await second.updateCe2Preferences({
      enabledModules: ['fractions'],
      eventId: 'second-profile-preference',
      lastDailyFamily: 'fractions',
      schemaVersion: 'ce2-preference-update/v1',
      updatedAt: new Date('2026-07-23T12:00:01.000Z'),
    })

    expect((await first.load()).ce2Preferences.enabledModules).toEqual(['arithmetic'])
    expect((await second.load()).ce2Preferences.enabledModules).toEqual(['fractions'])
    first.close()
    second.close()
  })
})

import 'fake-indexeddb/auto'

import { LearningEngine } from '@little-tables/domain'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

import { IndexedDbPracticeStore, InvalidStoredCompletionError } from './practice-store.js'

describe('IndexedDbPracticeStore', () => {
  const databases: string[] = []

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((name) => IndexedDbPracticeStore.delete(name)))
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
      bloomNumber: 1,
      correctAnswers: 1,
      finalAnswer: question.left * question.right,
      finalCorrect: true,
      sessionId: session.id,
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
      bloomNumber: 1,
      completedAt,
      correctAnswers: 0,
      finalAnswer: question.left * question.right,
      finalCorrect: false,
      sessionId: session.id,
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

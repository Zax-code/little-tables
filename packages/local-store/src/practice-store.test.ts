import 'fake-indexeddb/auto'

import { LearningEngine } from '@little-tables/domain'
import { afterEach, describe, expect, it } from 'vitest'

import { IndexedDbPracticeStore } from './practice-store.js'

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
      policy: { questionCount: 5 },
      seed: 3,
      snapshot,
    })

    await store.startSession(session, snapshot)
    expect((await store.load()).activeSession?.id).toBe(session.id)
    await store.completeSession(snapshot)
    const replacement = { ...snapshot, processedEventIds: ['from-server'] }
    await store.replaceSnapshot(replacement)

    expect(await store.load()).toMatchObject({
      activeSession: null,
      completedSessions: 1,
      snapshot: replacement,
    })
    store.close()
  })
})

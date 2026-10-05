import { Ce2Engine, type Ce2Attempt } from '@little-tables/domain'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { AttemptRepository } from '../repositories/attempt-repository.js'
import { InMemoryAttemptRepository } from '../repositories/in-memory-attempt-repository.js'
import { Ce2AttemptIngestion } from './ce2-attempt-ingestion.js'

const assistance = {
  guided: false,
  helpOpened: false,
  representationHints: 0,
  resultRevealed: false,
  switchedToFree: false,
} as const

const makeAttempt = (eventId: string): Ce2Attempt => {
  const snapshot = Ce2Engine.emptySnapshot()
  const session = Ce2Engine.createSession({
    kind: 'extra-practice',
    module: 'arithmetic',
    now: new Date('2026-10-04T12:00:00.000Z'),
    seed: 404,
    skill: 'A1',
    snapshot,
  })
  const question = session.questions[0]
  if (question === undefined) throw new Error('Expected a CE2 question')
  return Ce2Engine.answer({
    answer: question.solution,
    answeredAt: new Date('2026-10-04T12:00:02.000Z'),
    assistance,
    eventId,
    session,
  }).attempt
}

describe('Ce2AttemptIngestion', () => {
  it('re-evaluates client results and stores an event only once', async () => {
    const attempt = makeAttempt('ce2-server-attempt')
    const untrusted: Ce2Attempt = {
      ...attempt,
      evaluation: {
        canonicalValue: null,
        dimensions: {
          alignment: null,
          format: true,
          intermediate: null,
          model: null,
          ordering: null,
          procedure: null,
          value: false,
        },
        reason: 'wrong-value',
        status: 'incorrect',
      },
    }
    const program = Effect.gen(function* () {
      const first = yield* Ce2AttemptIngestion.ingest({
        attempts: [untrusted],
        preferenceUpdates: [],
        profileId: 'child-a',
      })
      const repeated = yield* Ce2AttemptIngestion.ingest({
        attempts: [untrusted],
        preferenceUpdates: [],
        profileId: 'child-a',
      })
      const repository = yield* AttemptRepository
      const stored = yield* repository.listCe2?.('child-a') ?? Effect.succeed([])
      return { first, repeated, stored }
    }).pipe(Effect.provide(InMemoryAttemptRepository.layer()))

    const result = await Effect.runPromise(program)
    expect(result.first).toEqual({
      accepted: ['ce2-server-attempt'],
      duplicates: [],
      rejected: [],
    })
    expect(result.repeated.duplicates).toEqual(['ce2-server-attempt'])
    expect(result.stored).toHaveLength(1)
    expect(result.stored[0]?.evaluation.status).toBe('correct')
  })

  it('rejects a question whose expected content was tampered with', async () => {
    const attempt = makeAttempt('ce2-tampered')
    if (attempt.question.family !== 'integer') throw new Error('Expected integer question')
    const tampered = {
      ...attempt,
      question: {
        ...attempt.question,
        solution: { ...attempt.question.solution, value: attempt.question.solution.value + 1 },
      },
    } satisfies Ce2Attempt
    const result = await Effect.runPromise(
      Ce2AttemptIngestion.ingest({
        attempts: [tampered],
        preferenceUpdates: [],
        profileId: 'child-a',
      }).pipe(Effect.provide(InMemoryAttemptRepository.layer())),
    )

    expect(result).toEqual({
      accepted: [],
      duplicates: [],
      rejected: [{ eventId: 'ce2-tampered', reason: 'invalid_question' }],
    })
  })

  it('unions module activation and keeps profiles isolated across replay', async () => {
    const program = Effect.gen(function* () {
      yield* Ce2AttemptIngestion.ingest({
        attempts: [],
        preferenceUpdates: [
          {
            enabledModules: ['arithmetic'],
            eventId: 'pref-a-1',
            lastDailyFamily: 'arithmetic',
            schemaVersion: 'ce2-preference-update/v1',
            updatedAt: new Date('2026-10-04T10:00:00.000Z'),
          },
          {
            enabledModules: ['fractions'],
            eventId: 'pref-a-2',
            lastDailyFamily: 'fractions',
            schemaVersion: 'ce2-preference-update/v1',
            updatedAt: new Date('2026-10-04T11:00:00.000Z'),
          },
        ],
        profileId: 'child-a',
      })
      const replay = yield* Ce2AttemptIngestion.ingest({
        attempts: [],
        preferenceUpdates: [
          {
            enabledModules: ['arithmetic'],
            eventId: 'pref-a-1',
            lastDailyFamily: 'arithmetic',
            schemaVersion: 'ce2-preference-update/v1',
            updatedAt: new Date('2026-10-04T10:00:00.000Z'),
          },
        ],
        profileId: 'child-a',
      })
      const repository = yield* AttemptRepository
      const first = yield* repository.loadCe2Preferences?.('child-a') ?? Effect.die('missing')
      const second = yield* repository.loadCe2Preferences?.('child-b') ?? Effect.die('missing')
      return { first, replay, second }
    }).pipe(Effect.provide(InMemoryAttemptRepository.layer()))

    const result = await Effect.runPromise(program)
    expect(result.first.enabledModules).toEqual(['arithmetic', 'fractions'])
    expect(result.first.lastDailyFamily).toBe('fractions')
    expect(result.replay.duplicates).toEqual(['pref-a-1'])
    expect(result.second.enabledModules).toEqual([])
  })
})

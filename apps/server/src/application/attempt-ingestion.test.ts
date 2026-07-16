import type { AttemptEvent } from '@little-tables/domain'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { AttemptIngestion } from './attempt-ingestion.js'
import { AttemptRepository } from '../repositories/attempt-repository.js'
import { InMemoryAttemptRepository } from '../repositories/in-memory-attempt-repository.js'

const attempt: AttemptEvent = {
  answerMode: 'choice',
  answeredAt: new Date('2026-07-12T12:00:00.000Z'),
  choices: [48, 54, 56, 64],
  correct: true,
  eventId: 'attempt-1',
  factKey: '7:8',
  latencyMs: 1700,
  left: 7,
  right: 8,
  questionCount: 10,
  selected: 56,
  sequence: 0,
  sessionId: 'session-1',
}

describe('AttemptIngestion', () => {
  it('accepts an attempt once and reports retries as duplicates', async () => {
    const program = Effect.gen(function* () {
      const first = yield* AttemptIngestion.ingest({ attempts: [attempt], profileId: 'lou' })
      const retry = yield* AttemptIngestion.ingest({ attempts: [attempt], profileId: 'lou' })
      return { first, retry }
    }).pipe(Effect.provide(InMemoryAttemptRepository.layer()))

    const result = await Effect.runPromise(program)

    expect(result.first).toEqual({ accepted: ['attempt-1'], duplicates: [], rejected: [] })
    expect(result.retry).toEqual({ accepted: [], duplicates: ['attempt-1'], rejected: [] })
  })

  it('accepts a consistent division attempt and preserves its learner-local day', async () => {
    const divisionAttempt: AttemptEvent = {
      ...attempt,
      answerMode: 'keypad',
      choices: [],
      eventId: 'division-attempt',
      factKey: 'divide:56:7',
      learningDayKey: '2026-07-12',
      left: 56,
      operation: 'divide',
      right: 7,
      selected: 8,
    }
    const layer = InMemoryAttemptRepository.layer()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ingested = yield* AttemptIngestion.ingest({
          attempts: [divisionAttempt],
          profileId: 'lou',
        })
        const repository = yield* AttemptRepository
        return { ingested, stored: yield* repository.list('lou') }
      }).pipe(Effect.provide(layer)),
    )

    expect(result.ingested).toEqual({
      accepted: ['division-attempt'],
      duplicates: [],
      rejected: [],
    })
    expect(result.stored[0]).toMatchObject({
      learningDayKey: '2026-07-12',
      operation: 'divide',
    })
  })

  it('rejects an internally contradictory attempt before persistence', async () => {
    const contradictory = { ...attempt, correct: false, eventId: 'contradictory' }
    const result = await Effect.runPromise(
      AttemptIngestion.ingest({ attempts: [contradictory], profileId: 'lou' }).pipe(
        Effect.provide(InMemoryAttemptRepository.layer()),
      ),
    )

    expect(result).toEqual({
      accepted: [],
      duplicates: [],
      rejected: [{ eventId: 'contradictory', reason: 'inconsistent_attempt' }],
    })
  })

  it('rejects a division attempt with a multiplication answer', async () => {
    const contradictory: AttemptEvent = {
      ...attempt,
      answerMode: 'keypad',
      choices: [],
      eventId: 'contradictory-division',
      factKey: 'divide:56:7',
      left: 56,
      operation: 'divide',
      right: 7,
      selected: 56 * 7,
    }
    const result = await Effect.runPromise(
      AttemptIngestion.ingest({ attempts: [contradictory], profileId: 'lou' }).pipe(
        Effect.provide(InMemoryAttemptRepository.layer()),
      ),
    )

    expect(result).toEqual({
      accepted: [],
      duplicates: [],
      rejected: [{ eventId: 'contradictory-division', reason: 'inconsistent_attempt' }],
    })
  })

  it('rejects a learner-local day that is formatted but not a real calendar date', async () => {
    const invalidDay: AttemptEvent = {
      ...attempt,
      eventId: 'invalid-learning-day',
      learningDayKey: '2026-02-31',
    }
    const result = await Effect.runPromise(
      AttemptIngestion.ingest({ attempts: [invalidDay], profileId: 'lou' }).pipe(
        Effect.provide(InMemoryAttemptRepository.layer()),
      ),
    )

    expect(result.rejected).toEqual([
      { eventId: 'invalid-learning-day', reason: 'inconsistent_attempt' },
    ])
  })
})

import type { AttemptEvent } from '@little-tables/domain'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { AttemptIngestion } from './attempt-ingestion.js'
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
})

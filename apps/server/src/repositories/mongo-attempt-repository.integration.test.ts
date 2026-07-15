import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb'
import type { AttemptEvent } from '@little-tables/domain'
import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AttemptIngestion } from '../application/attempt-ingestion.js'
import { AllowedEmailRepository } from './allowed-email-repository.js'
import { AttemptRepository } from './attempt-repository.js'
import { MongoAllowedEmailRepository } from './mongo-allowed-email-repository.js'
import { MongoAttemptRepository } from './mongo-attempt-repository.js'

describe('MongoAttemptRepository', () => {
  let container: StartedMongoDBContainer | undefined

  beforeAll(async () => {
    container = await new MongoDBContainer('mongo:7.0.17').start()
  }, 120_000)

  afterAll(async () => {
    await container?.stop()
  })

  it('atomically upserts events and lists them in learning order', async () => {
    const attempt: AttemptEvent = {
      answerMode: 'keypad',
      answeredAt: new Date('2026-07-12T12:00:00.000Z'),
      choices: [],
      correct: true,
      eventId: 'mongo-attempt-1',
      factKey: '7:8',
      latencyMs: 1400,
      left: 7,
      right: 8,
      questionCount: 1,
      selected: 56,
      sequence: 0,
      sessionId: 'mongo-session',
    }
    const program = Effect.gen(function* () {
      const first = yield* AttemptIngestion.ingest({ attempts: [attempt], profileId: 'lou' })
      const second = yield* AttemptIngestion.ingest({ attempts: [attempt], profileId: 'lou' })
      const repository = yield* AttemptRepository
      const stored = yield* repository.list('lou')
      return { first, second, stored }
    }).pipe(
      Effect.provide(
        MongoAttemptRepository.layer(
          `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`,
          'integration',
        ),
      ),
    )

    const result = await Effect.runPromise(program)

    expect(result.first.accepted).toEqual(['mongo-attempt-1'])
    expect(result.second.duplicates).toEqual(['mongo-attempt-1'])
    expect(result.stored).toEqual([attempt])
  }, 30_000)

  it('idempotently persists allowed email addresses', async () => {
    const program = Effect.gen(function* () {
      const repository = yield* AllowedEmailRepository
      const firstCreated = yield* repository.add('new.user@example.com', 'boomslang.a@gmail.com')
      const secondCreated = yield* repository.add('new.user@example.com', 'boomslang.a@gmail.com')
      const contains = yield* repository.contains('new.user@example.com')
      const emails = yield* repository.list()
      return { contains, emails, firstCreated, secondCreated }
    }).pipe(
      Effect.provide(
        MongoAllowedEmailRepository.layer(
          `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`,
          'integration',
        ),
      ),
    )

    await expect(Effect.runPromise(program)).resolves.toEqual({
      contains: true,
      emails: ['new.user@example.com'],
      firstCreated: true,
      secondCreated: false,
    })
  }, 30_000)
})

import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb'
import type { AttemptEvent } from '@little-tables/domain'
import { Effect } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AttemptIngestion } from '../application/attempt-ingestion.js'
import { AllowedEmailRepository } from './allowed-email-repository.js'
import { AttemptRepository } from './attempt-repository.js'
import { GardenCollectionRepository } from './garden-collection-repository.js'
import { MongoAllowedEmailRepository } from './mongo-allowed-email-repository.js'
import { MongoAttemptRepository } from './mongo-attempt-repository.js'
import { MongoGardenCollectionRepository } from './mongo-garden-collection-repository.js'
import { MongoProfileRepository } from './mongo-profile-repository.js'
import { ProfileRepository } from './profile-repository.js'

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
      yield* repository.remove('new.user@example.com', 'boomslang.a@gmail.com')
      const blocked = yield* repository.isBlocked('new.user@example.com')
      const removedEmails = yield* repository.list()
      const blockedEmails = yield* repository.listBlocked()
      const restored = yield* repository.add('new.user@example.com', 'boomslang.a@gmail.com')
      const contains = yield* repository.contains('new.user@example.com')
      const emails = yield* repository.list()
      const sessionVersion = yield* repository.sessionVersion('new.user@example.com')
      return {
        blocked,
        blockedEmails,
        contains,
        emails,
        firstCreated,
        removedEmails,
        restored,
        secondCreated,
        sessionVersion,
      }
    }).pipe(
      Effect.provide(
        MongoAllowedEmailRepository.layer(
          `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`,
          'integration',
        ),
      ),
    )

    await expect(Effect.runPromise(program)).resolves.toEqual({
      blocked: true,
      blockedEmails: ['new.user@example.com'],
      contains: true,
      emails: ['new.user@example.com'],
      firstCreated: true,
      removedEmails: [],
      restored: true,
      secondCreated: false,
      sessionVersion: 1,
    })
  }, 30_000)

  it('persists a preferred name for each Google account', async () => {
    const program = Effect.gen(function* () {
      const repository = yield* ProfileRepository
      const missing = yield* repository.findPreferredName('google-subject')
      const created = yield* repository.savePreferredName('google-subject', 'Lulu')
      const saved = yield* repository.findPreferredName('google-subject')
      const replaced = yield* repository.savePreferredName('google-subject', 'Lou')
      const retained = yield* repository.findPreferredName('google-subject')
      return { created, missing, replaced, retained, saved }
    }).pipe(
      Effect.provide(
        MongoProfileRepository.layer(
          `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`,
          'integration',
        ),
      ),
    )

    await expect(Effect.runPromise(program)).resolves.toEqual({
      created: true,
      missing: null,
      replaced: false,
      retained: 'Lulu',
      saved: 'Lulu',
    })
  }, 30_000)

  it('atomically preserves one duplicate-free personalized garden per learner', async () => {
    const gardenLayer = MongoGardenCollectionRepository.layer(
      `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`,
      'integration',
    )
    const program = Effect.gen(function* () {
      const repository = yield* GardenCollectionRepository
      const first = yield* repository.loadOrCreate({
        preferredFlowerPrefix: ['rose-lotus'],
        profileId: 'garden-learner',
      })
      const second = yield* repository.loadOrCreate({
        preferredFlowerPrefix: ['blue-wisteria'],
        profileId: 'garden-learner',
      })
      yield* repository.reconcile('garden-learner', {
        awardedFlowerIds: [first.flowerOrder[0] ?? 'rose-lotus'],
        bloomCount: 3,
        rewardedDayKeys: ['2026-07-23', '2026-07-24', '2026-07-25'],
      })
      const replayed = yield* repository.reconcile('garden-learner', {
        awardedFlowerIds: [first.flowerOrder[0] ?? 'rose-lotus'],
        bloomCount: 3,
        rewardedDayKeys: ['2026-07-25'],
      })
      return { first, replayed, second }
    }).pipe(Effect.provide(gardenLayer))

    const result = await Effect.runPromise(program)

    expect(result.second.flowerOrder).toEqual(result.first.flowerOrder)
    expect(new Set(result.first.flowerOrder).size).toBe(9)
    expect(result.replayed.awardedFlowerIds).toEqual([result.first.flowerOrder[0]])
    expect(result.replayed.rewardedDayKeys).toEqual(['2026-07-23', '2026-07-24', '2026-07-25'])
  }, 30_000)
})

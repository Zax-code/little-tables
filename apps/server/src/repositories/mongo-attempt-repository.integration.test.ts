import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb'
import type { AttemptEvent } from '@little-tables/domain'
import { Effect } from 'effect'
import { MongoClient } from 'mongodb'
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

  it('persists a family and its child profiles for each Google account', async () => {
    const program = Effect.gen(function* () {
      const repository = yield* ProfileRepository
      const created = yield* repository.ensureFamily({
        fallbackName: 'Lulu',
        googleSubject: 'google-subject',
        legacyProfileId: 'lou',
        retainLegacyProfileId: false,
      })
      const initialProfile = created.profiles[0]
      if (initialProfile === undefined) throw new Error('Expected an initial child profile')
      const nameChosen = yield* repository.completeInitialProfile(
        'google-subject',
        initialProfile.id,
        'Lou',
      )
      const added = yield* repository.addChild('google-subject', {
        avatarId: 'bluebell',
        name: 'Mia',
      })
      const saved = yield* repository.findFamily('google-subject')
      return { added, nameChosen, saved }
    }).pipe(
      Effect.provide(
        MongoProfileRepository.layer(
          `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`,
          'integration',
        ),
      ),
    )

    const result = await Effect.runPromise(program)
    expect(result.nameChosen).toBe(true)
    expect(result.added).toMatchObject({ avatarId: 'bluebell', name: 'Mia' })
    expect(result.saved).toMatchObject({
      onboardingComplete: true,
      profiles: [
        expect.objectContaining({ name: 'Lou' }),
        expect.objectContaining({ avatarId: 'bluebell', name: 'Mia' }),
      ],
    })
  }, 30_000)

  it('backfills a legacy single-profile document onto its existing practice profile ID', async () => {
    const uri = `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`
    const client = new MongoClient(uri)
    await client.connect()
    await client
      .db('integration')
      .collection<{ _id: string; displayName: string; updatedAt: Date }>('profiles')
      .insertOne({
        _id: 'legacy-google-subject',
        displayName: 'Lulu',
        updatedAt: new Date('2026-07-01T12:00:00.000Z'),
      })
    await client.close()

    const account = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* ProfileRepository
        return yield* repository.ensureFamily({
          fallbackName: 'Ignored Google Name',
          googleSubject: 'legacy-google-subject',
          legacyProfileId: 'lou',
          retainLegacyProfileId: true,
        })
      }).pipe(Effect.provide(MongoProfileRepository.layer(uri, 'integration'))),
    )

    expect(account).toMatchObject({
      onboardingComplete: true,
      profiles: [{ avatarId: 'sprout', id: 'lou', name: 'Lulu' }],
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

  it('does not attach shared legacy practice data to an account that cannot retain it', async () => {
    const uri = `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`
    const client = new MongoClient(uri)
    await client.connect()
    await client
      .db('integration')
      .collection<{ _id: string; displayName: string; updatedAt: Date }>('profiles')
      .insertOne({
        _id: 'unclaimed-legacy-google-subject',
        displayName: 'Mia',
        updatedAt: new Date('2026-07-02T12:00:00.000Z'),
      })
    await client.close()

    const account = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* ProfileRepository
        return yield* repository.ensureFamily({
          fallbackName: 'Ignored Google Name',
          googleSubject: 'unclaimed-legacy-google-subject',
          legacyProfileId: 'lou',
          retainLegacyProfileId: false,
        })
      }).pipe(Effect.provide(MongoProfileRepository.layer(uri, 'integration'))),
    )

    expect(account.onboardingComplete).toBe(true)
    expect(account.profiles).toEqual([expect.objectContaining({ avatarId: 'sprout', name: 'Mia' })])
    expect(account.profiles[0]?.id).not.toBe('lou')
  }, 30_000)
})

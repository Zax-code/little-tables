import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb'
import { Ce2Engine, type AttemptEvent } from '@little-tables/domain'
import { Effect } from 'effect'
import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AttemptIngestion } from '../application/attempt-ingestion.js'
import { Ce2AttemptIngestion } from '../application/ce2-attempt-ingestion.js'
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

  it('keeps CE2 events out of the legacy collection for rollback compatibility', async () => {
    const uri = `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`
    const snapshot = Ce2Engine.emptySnapshot()
    const session = Ce2Engine.createSession({
      kind: 'extra-practice',
      module: 'arithmetic',
      now: new Date('2026-10-04T12:00:00.000Z'),
      seed: 208,
      skill: 'A1',
      snapshot,
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected a CE2 question')
    const attempt = Ce2Engine.answer({
      answer: question.solution,
      answeredAt: new Date('2026-10-04T12:00:01.000Z'),
      assistance: {
        guided: false,
        helpOpened: false,
        representationHints: 0,
        resultRevealed: false,
        switchedToFree: false,
      },
      eventId: 'mongo-ce2-rollback-safe',
      session,
    }).attempt
    await Effect.runPromise(
      Ce2AttemptIngestion.ingest({
        attempts: [attempt],
        preferenceUpdates: [],
        profileId: 'rollback-profile',
      }).pipe(Effect.provide(MongoAttemptRepository.layer(uri, 'integration'))),
    )

    const client = new MongoClient(uri)
    await client.connect()
    const database = client.db('integration')
    const [legacyDocument, ce2Document] = await Promise.all([
      database
        .collection<{ _id: string; profileId: string }>('attempt_events')
        .findOne({ _id: attempt.eventId }),
      database
        .collection<{ _id: string; profileId: string }>('ce2_attempt_events')
        .findOne({ _id: attempt.eventId }),
    ])
    await client.close()

    expect(legacyDocument).toBeNull()
    expect(ce2Document).toMatchObject({ profileId: 'rollback-profile' })
  }, 30_000)

  it('does not remove another profile push subscription', async () => {
    const program = Effect.gen(function* () {
      const repository = yield* AttemptRepository
      yield* repository.upsertPushSubscription('notification-child-a', {
        endpoint: 'https://push.example/profile-isolation',
        expirationTime: null,
        keys: { auth: 'auth', p256dh: 'p256dh' },
        locale: 'fr',
        reminderHour: 18,
        timezone: 'Europe/Paris',
      })
      yield* repository.removePushSubscription(
        'notification-child-b',
        'https://push.example/profile-isolation',
      )
      const afterSiblingRemoval = yield* repository.listPushSubscriptions()
      yield* repository.removePushSubscription(
        'notification-child-a',
        'https://push.example/profile-isolation',
      )
      const afterOwnerRemoval = yield* repository.listPushSubscriptions()
      return { afterOwnerRemoval, afterSiblingRemoval }
    }).pipe(
      Effect.provide(
        MongoAttemptRepository.layer(
          `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`,
          'integration',
        ),
      ),
    )

    const result = await Effect.runPromise(program)
    expect(result.afterSiblingRemoval).toContainEqual(
      expect.objectContaining({
        endpoint: 'https://push.example/profile-isolation',
        profileId: 'notification-child-a',
      }),
    )
    expect(result.afterOwnerRemoval).not.toContainEqual(
      expect.objectContaining({ endpoint: 'https://push.example/profile-isolation' }),
    )
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

  it('persists each family member avatar and restores isolated choices after reconnect', async () => {
    const uri = `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`
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
        avatarId: 'colin-mallard',
        name: 'Mia',
      })
      const updated = yield* repository.updateChild('google-subject', initialProfile.id, {
        avatarId: 'mina-cat',
        name: 'Lou',
      })
      const saved = yield* repository.findFamily('google-subject')
      return { added, nameChosen, saved, updated }
    }).pipe(Effect.provide(MongoProfileRepository.layer(uri, 'integration')))

    const result = await Effect.runPromise(program)
    const restored = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* ProfileRepository
        return yield* repository.findFamily('google-subject')
      }).pipe(Effect.provide(MongoProfileRepository.layer(uri, 'integration'))),
    )
    expect(result.nameChosen).toBe(true)
    expect(result.added).toMatchObject({ avatarId: 'colin-mallard', name: 'Mia' })
    expect(result.updated).toMatchObject({ avatarId: 'mina-cat', name: 'Lou' })
    expect(result.saved).toMatchObject({
      onboardingComplete: true,
      profiles: [
        expect.objectContaining({ avatarId: 'mina-cat', name: 'Lou' }),
        expect.objectContaining({ avatarId: 'colin-mallard', name: 'Mia' }),
      ],
    })
    expect(restored).toEqual(result.saved)
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

  it('retains the owner legacy profile ID when no preferred-name document exists', async () => {
    const account = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* ProfileRepository
        return yield* repository.ensureFamily({
          fallbackName: 'Google Lou',
          googleSubject: 'owner-without-profile-document',
          legacyProfileId: 'lou',
          retainLegacyProfileId: true,
        })
      }).pipe(
        Effect.provide(
          MongoProfileRepository.layer(
            `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`,
            'integration',
          ),
        ),
      ),
    )

    expect(account).toMatchObject({
      onboardingComplete: false,
      profiles: [{ avatarId: 'sprout', id: 'lou', name: 'Google Lou' }],
    })
  }, 30_000)

  it('atomically defaults missing avatars and preserves retired IDs during concurrent updates', async () => {
    const uri = `${container?.getConnectionString() ?? 'mongodb://unavailable'}?directConnection=true`
    const client = new MongoClient(uri)
    await client.connect()
    const updatedAt = new Date('2026-07-20T12:00:00.000Z')
    await client
      .db('integration')
      .collection<{ _id: string; [key: string]: unknown }>('profiles')
      .insertOne({
        _id: 'avatarless-family-subject',
        onboardingComplete: true,
        profiles: [
          {
            createdAt: updatedAt,
            id: 'avatarless-member',
            name: 'Lou',
            updatedAt,
          },
          {
            avatarId: 'retired-avatar',
            createdAt: updatedAt,
            id: 'retired-avatar-member',
            name: 'Alex',
            updatedAt,
          },
          {
            createdAt: updatedAt,
            id: 'concurrent-avatar-member',
            name: 'Sam',
            updatedAt,
          },
        ],
        schemaVersion: 2,
        updatedAt,
      })
    await client.close()

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* ProfileRepository
        const [migrated, concurrentUpdate] = yield* Effect.all(
          [
            repository.ensureFamily({
              fallbackName: 'Ignored Google Name',
              googleSubject: 'avatarless-family-subject',
              legacyProfileId: 'lou',
              retainLegacyProfileId: false,
            }),
            repository.updateChild('avatarless-family-subject', 'concurrent-avatar-member', {
              avatarId: 'paco-dog',
              name: 'Sam',
            }),
          ],
          { concurrency: 'unbounded' },
        )
        const restored = yield* repository.findFamily('avatarless-family-subject')
        return { concurrentUpdate, migrated, restored }
      }).pipe(Effect.provide(MongoProfileRepository.layer(uri, 'integration'))),
    )
    const storedClient = new MongoClient(uri)
    await storedClient.connect()
    const stored = await storedClient
      .db('integration')
      .collection<{ _id: string; profiles: ReadonlyArray<{ avatarId?: string; id: string }> }>(
        'profiles',
      )
      .findOne({ _id: 'avatarless-family-subject' })
    await storedClient.close()

    expect(result.concurrentUpdate).toMatchObject({
      avatarId: 'paco-dog',
      id: 'concurrent-avatar-member',
    })
    expect(result.restored?.profiles).toEqual([
      expect.objectContaining({ avatarId: 'sprout', id: 'avatarless-member' }),
      expect.objectContaining({ avatarId: 'sprout', id: 'retired-avatar-member' }),
      expect.objectContaining({ avatarId: 'paco-dog', id: 'concurrent-avatar-member' }),
    ])
    expect(stored?.profiles.find(({ id }) => id === 'retired-avatar-member')?.avatarId).toBe(
      'retired-avatar',
    )
  }, 30_000)

  it('atomically preserves isolated duplicate-free personalized gardens per family profile', async () => {
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
      const siblingFirst = yield* repository.loadOrCreate({
        preferredFlowerPrefix: ['twilight-lupine'],
        profileId: 'garden-sibling',
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
      const siblingReturning = yield* repository.loadOrCreate({
        preferredFlowerPrefix: ['rose-lotus'],
        profileId: 'garden-sibling',
      })
      return { first, replayed, second, siblingFirst, siblingReturning }
    }).pipe(Effect.provide(gardenLayer))

    const result = await Effect.runPromise(program)

    expect(result.second.flowerOrder).toEqual(result.first.flowerOrder)
    expect(new Set(result.first.flowerOrder).size).toBe(9)
    expect(result.replayed.awardedFlowerIds).toEqual([result.first.flowerOrder[0]])
    expect(result.replayed.rewardedDayKeys).toEqual(['2026-07-23', '2026-07-24', '2026-07-25'])
    expect(result.siblingReturning.flowerOrder).toEqual(result.siblingFirst.flowerOrder)
    expect(result.siblingReturning.awardedFlowerIds).toEqual([])
    expect(result.siblingReturning.bloomCount).toBe(0)
    expect(result.siblingReturning.rewardedDayKeys).toEqual([])
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

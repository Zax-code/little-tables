import { HttpApp } from '@effect/platform'
import { NodeHttpPlatform } from '@effect/platform-node'
import type { AttemptEvent } from '@little-tables/domain'
import { Effect, Layer, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  AttemptRepository,
  type AttemptRepositoryService,
  type PushSubscriptionInput,
} from '../repositories/attempt-repository.js'
import { InMemoryAllowedEmailRepository } from '../repositories/in-memory-allowed-email-repository.js'
import { InMemoryAttemptRepository } from '../repositories/in-memory-attempt-repository.js'
import { InMemoryGardenCollectionRepository } from '../repositories/in-memory-garden-collection-repository.js'
import { InMemoryProfileRepository } from '../repositories/in-memory-profile-repository.js'
import { httpApp } from './app.js'

const baseAttempt: AttemptEvent = {
  answerMode: 'keypad',
  answeredAt: new Date('2026-07-16T03:30:00.000Z'),
  choices: [],
  correct: true,
  eventId: 'attempt-1',
  factKey: '7:8',
  latencyMs: 1_700,
  left: 7,
  right: 8,
  questionCount: 1,
  selected: 56,
  sequence: 0,
  sessionId: 'session-1',
}

const GardenBootstrapTestSchema = Schema.Struct({
  gardenCollection: Schema.Struct({
    awardedFlowerIds: Schema.Array(Schema.String),
    flowerOrder: Schema.Array(Schema.String),
    introductionSeen: Schema.optional(Schema.Boolean),
  }),
})

const decodeGardenBootstrap = async (response: Response) =>
  Schema.decodeUnknownPromise(GardenBootstrapTestSchema)(await response.json())

const repositoryWithAttempts = (
  attempts: ReadonlyArray<AttemptEvent>,
): AttemptRepositoryService => ({
  health: Effect.void,
  insert: (_profileId, inserted) =>
    Effect.succeed({ accepted: inserted.map(({ eventId }) => eventId), duplicates: [] }),
  list: () => Effect.succeed(attempts),
  listPushSubscriptions: () => Effect.succeed([]),
  markPushSubscriptionSent: () => Effect.void,
  removePushSubscription: () => Effect.void,
  upsertPushSubscription: () => Effect.void,
})

const webHandler = (repository: AttemptRepositoryService) =>
  HttpApp.toWebHandlerLayer(
    httpApp,
    Layer.mergeAll(
      NodeHttpPlatform.layer,
      Layer.succeed(AttemptRepository, repository),
      InMemoryAllowedEmailRepository.layer(),
      InMemoryGardenCollectionRepository.layer(),
      InMemoryProfileRepository.layer(),
    ),
  )

describe('practice HTTP interface', () => {
  it('accepts and preserves an operation-aware attempt', async () => {
    let stored: ReadonlyArray<AttemptEvent> = []
    const repository: AttemptRepositoryService = {
      ...repositoryWithAttempts([]),
      insert: (_profileId, attempts) =>
        Effect.sync(() => {
          stored = attempts
          return { accepted: attempts.map(({ eventId }) => eventId), duplicates: [] }
        }),
    }
    const { dispose, handler } = webHandler(repository)
    const response = await handler(
      new Request('http://little-tables.local/api/v1/attempts/sync', {
        body: JSON.stringify({
          attempts: [
            {
              ...baseAttempt,
              answeredAt: baseAttempt.answeredAt.toISOString(),
              eventId: 'division-attempt',
              factKey: 'divide:56:7',
              learningDayKey: '2026-07-15',
              left: 56,
              operation: 'divide',
              right: 7,
              selected: 8,
            },
          ],
          profileId: 'client-profile-id-is-ignored',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    await dispose()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      accepted: ['division-attempt'],
      duplicates: [],
      rejected: [],
    })
    expect(stored[0]).toMatchObject({
      answeredAt: baseAttempt.answeredAt,
      learningDayKey: '2026-07-15',
      operation: 'divide',
    })
  })

  it('continues to accept legacy multiplication attempts without phase-two fields', async () => {
    let stored: ReadonlyArray<AttemptEvent> = []
    const repository: AttemptRepositoryService = {
      ...repositoryWithAttempts([]),
      insert: (_profileId, attempts) =>
        Effect.sync(() => {
          stored = attempts
          return { accepted: attempts.map(({ eventId }) => eventId), duplicates: [] }
        }),
    }
    const { dispose, handler } = webHandler(repository)
    const response = await handler(
      new Request('http://little-tables.local/api/v1/attempts/sync', {
        body: JSON.stringify({
          attempts: [{ ...baseAttempt, answeredAt: baseAttempt.answeredAt.toISOString() }],
          profileId: 'legacy-client-profile',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    await dispose()

    expect(response.status).toBe(200)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ eventId: 'attempt-1', operation: 'multiply' })
  })

  it('returns learner-local practice and reward days without double-rewarding a day', async () => {
    const attempts: ReadonlyArray<AttemptEvent> = [
      { ...baseAttempt, learningDayKey: '2026-07-15' },
      {
        ...baseAttempt,
        answeredAt: new Date('2026-07-16T15:00:00.000Z'),
        eventId: 'attempt-2',
        learningDayKey: '2026-07-15',
        sessionId: 'session-2',
        sessionKind: 'daily-watering',
      },
      {
        ...baseAttempt,
        answeredAt: new Date('2026-07-17T15:00:00.000Z'),
        eventId: 'attempt-3',
        sessionId: 'session-3',
        sessionKind: 'extra-practice',
      },
      {
        ...baseAttempt,
        answeredAt: new Date('2026-07-16T16:00:00.000Z'),
        eventId: 'attempt-in-progress',
        learningDayKey: '2026-07-16',
        questionCount: 2,
        sessionId: 'session-in-progress',
      },
    ]
    const { dispose, handler } = webHandler(repositoryWithAttempts(attempts))
    const response = await handler(new Request('http://little-tables.local/api/v1/bootstrap'))
    const body: unknown = await response.json()
    await dispose()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      completedSessions: 3,
      gardenBloomCount: 1,
      practiceDayKeys: ['2026-07-15', '2026-07-16', '2026-07-17'],
      rewardedDayKeys: ['2026-07-15'],
    })
  })

  it('returns and durably reconciles the personalized flower collection', async () => {
    const attempts = ['2026-07-23', '2026-07-24', '2026-07-25'].map(
      (learningDayKey, index): AttemptEvent => ({
        ...baseAttempt,
        answeredAt: new Date(`${learningDayKey}T15:00:00.000Z`),
        eventId: `daily-${index}`,
        learningDayKey,
        sessionId: `daily-session-${index}`,
        sessionKind: 'daily-watering',
      }),
    )
    const { dispose, handler } = webHandler(repositoryWithAttempts(attempts))
    const firstResponse = await handler(new Request('http://little-tables.local/api/v1/bootstrap'))
    const first = await decodeGardenBootstrap(firstResponse)
    const secondResponse = await handler(new Request('http://little-tables.local/api/v1/bootstrap'))
    const second = await decodeGardenBootstrap(secondResponse)
    await handler(
      new Request('http://little-tables.local/api/v1/garden/introduction-seen', {
        method: 'POST',
      }),
    )
    const withIntroductionSeenResponse = await handler(
      new Request('http://little-tables.local/api/v1/bootstrap'),
    )
    const withIntroductionSeen = await decodeGardenBootstrap(withIntroductionSeenResponse)
    await dispose()

    expect(first.gardenCollection.flowerOrder).toHaveLength(9)
    expect(new Set(first.gardenCollection.flowerOrder).size).toBe(9)
    expect(first.gardenCollection.awardedFlowerIds).toEqual([first.gardenCollection.flowerOrder[0]])
    expect(second.gardenCollection).toEqual(first.gardenCollection)
    expect(withIntroductionSeen.gardenCollection).toMatchObject({
      introductionSeen: true,
    })
  })
})

describe('notification subscriptions', () => {
  it('accepts a browser subscription that omits expirationTime', async () => {
    let saved: PushSubscriptionInput | null = null
    const repository: AttemptRepositoryService = {
      health: Effect.void,
      insert: (_profileId, attempts) =>
        Effect.succeed({ accepted: attempts.map(({ eventId }) => eventId), duplicates: [] }),
      list: () => Effect.succeed([]),
      listPushSubscriptions: () => Effect.succeed([]),
      markPushSubscriptionSent: () => Effect.void,
      removePushSubscription: () => Effect.void,
      upsertPushSubscription: (_profileId, subscription) =>
        Effect.sync(() => {
          saved = subscription
        }),
    }
    const { dispose, handler } = HttpApp.toWebHandlerLayer(
      httpApp,
      Layer.mergeAll(
        NodeHttpPlatform.layer,
        Layer.succeed(AttemptRepository, repository),
        InMemoryAllowedEmailRepository.layer(),
        InMemoryGardenCollectionRepository.layer(),
        InMemoryProfileRepository.layer(),
      ),
    )
    const response = await handler(
      new Request('http://little-tables.local/api/v1/notifications/subscriptions', {
        body: JSON.stringify({
          subscription: {
            endpoint: 'https://push.example/subscription',
            keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
          },
          timezone: 'America/New_York',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    await dispose()

    expect(response.status).toBe(200)
    expect(saved).toMatchObject({
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      locale: 'fr',
      timezone: 'America/New_York',
    })
  })
})

describe('allowed email management', () => {
  it('fails closed when real Google authentication is disabled', async () => {
    const { dispose, handler } = HttpApp.toWebHandlerLayer(
      httpApp,
      Layer.mergeAll(
        NodeHttpPlatform.layer,
        InMemoryAttemptRepository.layer(),
        InMemoryAllowedEmailRepository.layer(),
        InMemoryGardenCollectionRepository.layer(),
        InMemoryProfileRepository.layer(),
      ),
    )
    const added = await handler(
      new Request('http://little-tables.local/api/v1/admin/allowed-emails', {
        body: JSON.stringify({ email: 'new.user@example.com' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    const listed = await handler(
      new Request('http://little-tables.local/api/v1/admin/allowed-emails'),
    )
    await dispose()

    expect(added.status).toBe(401)
    expect(listed.status).toBe(401)
  })
})

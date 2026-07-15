import { HttpApp } from '@effect/platform'
import { NodeHttpPlatform } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  AttemptRepository,
  type AttemptRepositoryService,
  type PushSubscriptionInput,
} from '../repositories/attempt-repository.js'
import { httpApp } from './app.js'

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
      Layer.merge(NodeHttpPlatform.layer, Layer.succeed(AttemptRepository, repository)),
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
      timezone: 'America/New_York',
    })
  })
})

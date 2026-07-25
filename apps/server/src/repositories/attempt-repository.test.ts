import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { AttemptRepository } from './attempt-repository.js'
import { InMemoryAttemptRepository } from './in-memory-attempt-repository.js'

describe('AttemptRepository', () => {
  it('removes a push subscription only for its owning profile', async () => {
    const remaining = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* AttemptRepository
        yield* repository.upsertPushSubscription('child-a', {
          endpoint: 'https://push.example/subscription',
          expirationTime: null,
          keys: { auth: 'auth', p256dh: 'p256dh' },
          locale: 'fr',
          reminderHour: 18,
          timezone: 'Europe/Paris',
        })
        yield* repository.removePushSubscription('child-b', 'https://push.example/subscription')
        return yield* repository.listPushSubscriptions()
      }).pipe(Effect.provide(InMemoryAttemptRepository.layer())),
    )

    expect(remaining).toEqual([
      expect.objectContaining({
        endpoint: 'https://push.example/subscription',
        profileId: 'child-a',
      }),
    ])
  })
})

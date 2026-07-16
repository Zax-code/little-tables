import { describe, expect, it } from 'vitest'

import { serializePushSubscription } from './push-subscription.js'

describe('push subscription', () => {
  it('normalizes an omitted expirationTime before saving a subscription', () => {
    const subscription = {
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      toJSON: () => ({
        endpoint: 'https://push.example/subscription',
        keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
      }),
    }

    expect(serializePushSubscription(subscription)).toEqual({
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
    })
  })
})

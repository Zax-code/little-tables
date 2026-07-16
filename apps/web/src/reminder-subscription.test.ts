import { afterEach, describe, expect, it, vi } from 'vitest'

import { syncExistingReminderLocale } from './reminder-subscription.js'

const subscription = {
  endpoint: 'https://push.example/subscription',
  expirationTime: null,
  toJSON: () => ({ keys: { auth: 'auth', p256dh: 'p256dh' } }),
}

describe('syncExistingReminderLocale', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates an existing push subscription when the language changes', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('window', { Notification: {}, PushManager: {} })
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: () => Promise.resolve(subscription) },
        }),
      },
    })

    await syncExistingReminderLocale('en')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/notifications/subscriptions')
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"locale":"en"')
  })
})

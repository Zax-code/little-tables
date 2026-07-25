import { describe, expect, it, vi } from 'vitest'

import { serviceWorkerLocaleMessage, syncServiceWorkerLocale } from './service-worker-locale.js'

describe('service worker locale', () => {
  it('sends a persisted Simplified Chinese choice to the active worker', async () => {
    const postMessage = vi.fn()
    const serviceWorker = {
      ready: Promise.resolve({
        active: { postMessage },
      } as unknown as ServiceWorkerRegistration),
    }

    await syncServiceWorkerLocale('zh-Hans', serviceWorker)

    expect(postMessage).toHaveBeenCalledWith(serviceWorkerLocaleMessage('zh-Hans'))
  })

  it('ignores worker availability failures', async () => {
    await expect(
      syncServiceWorkerLocale('zh-Hans', {
        ready: Promise.reject(new Error('worker unavailable')),
      }),
    ).resolves.toBeUndefined()
  })
})

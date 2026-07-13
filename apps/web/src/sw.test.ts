import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }))
vi.mock('workbox-precaching', () => ({ precacheAndRoute: vi.fn() }))
vi.mock('workbox-routing', () => ({ registerRoute: vi.fn() }))
vi.mock('workbox-strategies', () => ({
  CacheFirst: vi.fn(),
  NetworkFirst: vi.fn(),
}))

describe('service worker updates', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('activates the waiting worker when Workbox requests an update', async () => {
    const listeners = new Map<string, EventListener>()
    const skipWaiting = vi.fn()

    vi.stubGlobal('self', {
      __WB_MANIFEST: [],
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener)
      }),
      clients: {
        matchAll: vi.fn(),
        openWindow: vi.fn(),
      },
      location: { origin: 'https://little-tables.test' },
      registration: { showNotification: vi.fn() },
      skipWaiting,
    })

    await import('./sw.js')

    const onMessage = listeners.get('message')
    expect(onMessage).toBeDefined()

    onMessage?.({ data: { type: 'SKIP_WAITING' } } as MessageEvent)

    expect(skipWaiting).toHaveBeenCalledOnce()
  })
})

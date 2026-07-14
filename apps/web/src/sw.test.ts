import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }))
vi.mock('workbox-precaching', () => ({ precacheAndRoute: vi.fn() }))
vi.mock('workbox-routing', () => ({ registerRoute: vi.fn() }))
vi.mock('workbox-strategies', () => ({
  CacheFirst: vi.fn(),
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

  it('activates this recovery release immediately for already-installed PWAs', async () => {
    const listeners = new Map<string, EventListener>()
    const activation = Promise.resolve()
    const skipWaiting = vi.fn(() => activation)

    vi.stubGlobal('self', {
      __WB_MANIFEST: [],
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener)
      }),
      clients: { matchAll: vi.fn(), openWindow: vi.fn() },
      location: { origin: 'https://little-tables.test' },
      registration: { showNotification: vi.fn() },
      skipWaiting,
    })

    await import('./sw.js')

    const waitUntil = vi.fn()
    listeners.get('install')?.({ waitUntil } as unknown as ExtendableEvent)

    expect(skipWaiting).toHaveBeenCalledOnce()
    expect(waitUntil).toHaveBeenCalledWith(activation)
  })

  it('deletes the legacy cache that may contain authenticated bootstrap data', async () => {
    const listeners = new Map<string, EventListener>()
    const deleteCache = vi.fn().mockResolvedValue(true)

    vi.stubGlobal('caches', { delete: deleteCache })
    vi.stubGlobal('self', {
      __WB_MANIFEST: [],
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener)
      }),
      clients: { matchAll: vi.fn(), openWindow: vi.fn() },
      location: { origin: 'https://little-tables.test' },
      registration: { showNotification: vi.fn() },
      skipWaiting: vi.fn(),
    })

    await import('./sw.js')

    const waitUntil = vi.fn()
    listeners.get('activate')?.({ waitUntil } as unknown as ExtendableEvent)

    expect(deleteCache).toHaveBeenCalledWith('little-tables-bootstrap-v1')
    expect(waitUntil).toHaveBeenCalledOnce()
  })
})

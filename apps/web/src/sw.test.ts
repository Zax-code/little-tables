import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cacheFirstSpy, registerRouteSpy } = vi.hoisted(() => ({
  cacheFirstSpy: vi.fn(),
  registerRouteSpy: vi.fn(),
}))

vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }))
vi.mock('workbox-precaching', () => ({ precacheAndRoute: vi.fn() }))
vi.mock('workbox-routing', () => ({ registerRoute: registerRouteSpy }))
vi.mock('workbox-strategies', () => ({
  CacheFirst: cacheFirstSpy,
}))

describe('service worker updates', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
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

  it('uses a new immutable image cache namespace for character assets', async () => {
    vi.stubGlobal('self', {
      __WB_MANIFEST: [],
      addEventListener: vi.fn(),
      clients: { matchAll: vi.fn(), openWindow: vi.fn() },
      location: { origin: 'https://little-tables.test' },
      registration: { showNotification: vi.fn() },
      skipWaiting: vi.fn(),
    })

    await import('./sw.js')

    expect(cacheFirstSpy).toHaveBeenCalledWith({
      cacheName: 'little-tables-visuals-v3',
    })
    expect(registerRouteSpy).toHaveBeenCalled()
  })

  it('keeps an update waiting so the current release retains its cached chunks', async () => {
    const listeners = new Map<string, EventListener>()
    const skipWaiting = vi.fn()

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

    expect(listeners.has('install')).toBe(false)
    expect(skipWaiting).not.toHaveBeenCalled()
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
    expect(deleteCache).toHaveBeenCalledWith('little-tables-visuals-v2')
    expect(waitUntil).toHaveBeenCalledOnce()
  })

  it('uses the selected Simplified Chinese locale for a push fallback', async () => {
    const listeners = new Map<string, EventListener>()
    const localeResponses = new Map<string, Response>()
    const showNotification = vi.fn().mockResolvedValue(undefined)
    const cache = {
      put: vi.fn((key: string, response: Response) => {
        localeResponses.set(key, response)
        return Promise.resolve()
      }),
    }

    vi.stubGlobal('caches', {
      delete: vi.fn(),
      match: vi.fn((key: string) => Promise.resolve(localeResponses.get(key))),
      open: vi.fn(() => Promise.resolve(cache)),
    })
    vi.stubGlobal('self', {
      __WB_MANIFEST: [],
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener)
      }),
      clients: { matchAll: vi.fn(), openWindow: vi.fn() },
      location: { origin: 'https://little-tables.test' },
      registration: { showNotification },
      skipWaiting: vi.fn(),
    })

    await import('./sw.js')

    let localeSaved: Promise<unknown> | undefined
    listeners.get('message')?.({
      data: { locale: 'zh-Hans', type: 'SET_LOCALE' },
      waitUntil: (promise: Promise<unknown>) => {
        localeSaved = promise
      },
    } as unknown as ExtendableMessageEvent)
    await localeSaved

    let notificationShown: Promise<unknown> | undefined
    listeners.get('push')?.({
      data: null,
      waitUntil: (promise: Promise<unknown>) => {
        notificationShown = promise
      },
    } as unknown as PushEvent)
    await notificationShown

    expect(showNotification).toHaveBeenCalledWith(
      'little tables.',
      expect.objectContaining({ body: '来做一会儿小练习吧 ♡' }),
    )
  })
})

/// <reference lib="webworker" />
/**
 * The service worker (`docs/rewrite/TECHNICAL_SPEC.md` §4.5): the app, its engine and the default
 * character are precached; other images are cached on first use; the API is never cached.
 */
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

type Language = 'en' | 'fr' | 'zh-Hans'

const languageCache = 'little-tables-preferences-v1'
const languageKey = '/__little-tables-locale'
const languages: ReadonlyArray<Language> = ['en', 'fr', 'zh-Hans']
const fallbackCopies: Readonly<Record<Language, string>> = {
  en: 'A tiny win will make your garden grow ♡',
  fr: 'Une petite séance fera pousser ton jardin ♡',
  'zh-Hans': '来做一个小小练习，让你的花园继续长大吧 ♡',
}

const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && languages.some((language) => language === value)

const readLanguage = async (): Promise<Language> => {
  try {
    const response = await caches.match(languageKey, { cacheName: languageCache })
    const language = await response?.text()
    return isLanguage(language) ? language : 'fr'
  } catch {
    return 'fr'
  }
}

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('activate', (event) => {
  // Caches of the previous app; the images cache is kept, its content is the same.
  event.waitUntil(
    Promise.all([
      caches.delete('little-tables-bootstrap-v1'),
      caches.delete('little-tables-visuals-v2'),
    ]),
  )
})

self.addEventListener('message', (event) => {
  const message: unknown = event.data
  if (typeof message !== 'object' || message === null || !('type' in message)) return
  if (message.type === 'SET_LOCALE' && 'language' in message && isLanguage(message.language)) {
    const language = message.language
    event.waitUntil(
      caches.open(languageCache).then((cache) => cache.put(languageKey, new Response(language))),
    )
  } else if (message.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const language = await readLanguage()
      const fallback = {
        body: fallbackCopies[language],
        icon: '/icons/icon-192.png',
        tag: 'little-tables-daily',
        title: 'little tables.',
        url: '/',
      }
      let payload = fallback
      try {
        payload = { ...fallback, ...(event.data?.json() as Partial<typeof fallback>) }
      } catch {
        // A push without JSON still shows a useful notification.
      }
      await self.registration.showNotification(payload.title, {
        badge: '/icons/favicon-32.png',
        body: payload.body,
        data: { url: payload.url },
        icon: payload.icon,
        tag: payload.tag,
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data: unknown = event.notification.data
  const path =
    typeof data === 'object' && data !== null && 'url' in data && typeof data.url === 'string'
      ? data.url
      : '/'
  const target = new URL(path, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(async (windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin))
      if (existing !== undefined) {
        await existing.navigate(target)
        return existing.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})

registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    request.destination === 'image',
  new CacheFirst({ cacheName: 'little-tables-visuals-v3' }),
)

// The verb index of the parent's catalogue: loaded on demand, kept for offline visits.
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname.startsWith('/verbs/'),
  new StaleWhileRevalidate({ cacheName: 'little-tables-verbs-v1' }),
)

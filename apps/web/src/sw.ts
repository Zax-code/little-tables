/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

import type { Locale } from './i18n-catalog.js'

declare const self: ServiceWorkerGlobalScope

const localeCacheName = 'little-tables-preferences-v1'
const localeCacheKey = '/__little-tables-locale'
const supportedLocales: ReadonlyArray<Locale> = ['en', 'fr', 'zh-Hans']
const notificationFallbackCopies = {
  en: 'Ready for a tiny session? ♡',
  fr: 'Une petite séance t’attend ♡',
  'zh-Hans': '来做一会儿小练习吧 ♡',
} as const satisfies Readonly<Record<Locale, string>>

const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && supportedLocales.some((locale) => locale === value)

const saveLocale = async (locale: Locale): Promise<void> => {
  const cache = await caches.open(localeCacheName)
  await cache.put(localeCacheKey, new Response(locale))
}

const readLocale = async (): Promise<Locale> => {
  try {
    const response = await caches.match(localeCacheKey, { cacheName: localeCacheName })
    const locale = await response?.text()
    return isLocale(locale) ? locale : 'fr'
  } catch {
    return 'fr'
  }
}

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.delete('little-tables-bootstrap-v1'),
      caches.delete('little-tables-visuals-v2'),
    ]),
  )
})

self.addEventListener('message', (event) => {
  const message: unknown = event.data
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'SET_LOCALE' &&
    'locale' in message &&
    isLocale(message.locale)
  ) {
    event.waitUntil(saveLocale(message.locale))
    return
  }
  const isSkipWaitingMessage =
    message === 'SKIP_WAITING' ||
    (typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'SKIP_WAITING')

  if (isSkipWaitingMessage) void self.skipWaiting()
})

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const locale = await readLocale()
      const fallback = {
        body: notificationFallbackCopies[locale],
        icon: '/icons/icon-192.png',
        tag: 'little-tables-daily',
        title: 'little tables.',
        url: '/',
      }
      let payload = fallback
      try {
        payload = { ...fallback, ...(event.data?.json() as Partial<typeof fallback>) }
      } catch {
        // A valid push without JSON still gets a useful visible notification.
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
  const notificationData: unknown = event.notification.data
  const path =
    typeof notificationData === 'object' &&
    notificationData !== null &&
    'url' in notificationData &&
    typeof notificationData.url === 'string'
      ? notificationData.url
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

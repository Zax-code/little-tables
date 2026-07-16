/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('little-tables-bootstrap-v1'))
})

self.addEventListener('message', (event) => {
  const message: unknown = event.data
  const isSkipWaitingMessage =
    message === 'SKIP_WAITING' ||
    (typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'SKIP_WAITING')

  if (isSkipWaitingMessage) void self.skipWaiting()
})

self.addEventListener('push', (event) => {
  const fallback = {
    body: 'Ready for a tiny tables win? ♡',
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
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      badge: '/icons/favicon-32.png',
      body: payload.body,
      data: { url: payload.url },
      icon: payload.icon,
      tag: payload.tag,
    }),
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
  new CacheFirst({ cacheName: 'little-tables-visuals-v2' }),
)

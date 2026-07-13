/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') void self.skipWaiting()
})

registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')),
  new CacheFirst({ cacheName: 'little-tables-visuals-v1' }),
)

registerRoute(
  ({ request, url }) => request.method === 'GET' && url.pathname === '/api/v1/bootstrap',
  new NetworkFirst({ cacheName: 'little-tables-bootstrap-v1', networkTimeoutSeconds: 2 }),
)

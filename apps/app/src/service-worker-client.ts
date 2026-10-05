/** Registering the service worker, checking for updates and reloading on the latest version. */
import { Workbox } from 'workbox-window'

import type { Language } from './data/schema.js'

const UPDATE_CHECK_MS = 60_000

let workbox: Workbox | null = null
const waitingListeners = new Set<() => void>()
let waiting = false

/** Whether a new version is installed and waiting. */
export const isUpdateWaiting = () => waiting

/** Calls `listener` when a new version starts waiting; returns how to stop listening. */
export const onUpdateWaiting = (listener: () => void) => {
  waitingListeners.add(listener)
  return () => {
    waitingListeners.delete(listener)
  }
}

/** Registers the service worker of production builds. */
export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || workbox !== null) return
  workbox = new Workbox('/sw.js')
  workbox.addEventListener('waiting', () => {
    waiting = true
    for (const listener of waitingListeners) listener()
  })
  void workbox.register().then((registration) => {
    if (registration === undefined) return
    const check = () => {
      if (document.visibilityState === 'visible') void registration.update().catch(() => undefined)
    }
    window.setInterval(check, UPDATE_CHECK_MS)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
  })
}

/** Tells the service worker which language reminders should use. */
export const shareLanguage = (language: Language) => {
  if (!('serviceWorker' in navigator)) return
  void navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage({ language, type: 'SET_LOCALE' }))
    .catch(() => undefined)
}

/** Activates a waiting version, then reloads; reloading alone still helps when that fails. */
export async function reloadWithLatestServiceWorker() {
  try {
    const registration =
      'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    await registration?.update()
    const next = registration?.waiting
    if (next !== null && next !== undefined) {
      const controlling = new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        })
      })
      next.postMessage({ type: 'SKIP_WAITING' })
      await Promise.race([
        controlling,
        new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
      ])
    }
  } catch {
    // Reloading is still the most useful recovery.
  } finally {
    window.location.reload()
  }
}

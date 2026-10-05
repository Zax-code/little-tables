/**
 * The service worker: registration, update checks while the app is visible, the non-blocking
 * "new version" banner (mockup B5) and reloading on the latest version.
 */
import { Button } from '@little-tables/ui'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Workbox } from 'workbox-window'

import type { Language } from './data/schema.js'
import { useI18n } from './i18n/i18n.js'

const UPDATE_CHECK_MS = 60_000

let workbox: Workbox | null = null
const waitingListeners = new Set<() => void>()
let waiting = false

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

/** B5: a new version is ready; the child can finish what they are doing. */
export function UpdateBanner() {
  const { t } = useI18n()
  const [ready, setReady] = useState(waiting)
  useEffect(() => {
    const listener = () => setReady(true)
    waitingListeners.add(listener)
    return () => {
      waitingListeners.delete(listener)
    }
  }, [])
  if (!ready) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 safe-top">
      <div
        className="pointer-events-auto mt-2 flex w-full max-w-md items-center gap-3 rounded-card bg-surface p-3 shadow-[0_8px_24px_var(--lt-shadow)]"
        role="status"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-leaf-soft text-leaf">
          <Sparkles aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className="text-subhead font-extrabold">{t('pwa.updateTitle')}</strong>
          <span className="text-footnote font-semibold text-label-2">{t('pwa.updateCopy')}</span>
        </div>
        <Button onClick={() => void reloadWithLatestServiceWorker()} size="sm">
          {t('pwa.update')}
        </Button>
      </div>
    </div>
  )
}

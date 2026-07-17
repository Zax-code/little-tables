export const updateCheckIntervalMs = 60_000

type UpdateRegistration = Readonly<{
  update: () => Promise<unknown>
}>

type UpdateWindow = Pick<
  Window,
  'addEventListener' | 'clearInterval' | 'removeEventListener' | 'setInterval'
>
type UpdateDocument = Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>

type UpdateCheckOptions = Readonly<{
  documentTarget?: UpdateDocument
  intervalMs?: number
  windowTarget?: UpdateWindow
}>

export function startServiceWorkerUpdateChecks(
  registration: UpdateRegistration,
  options: UpdateCheckOptions = {},
): () => void {
  const documentTarget = options.documentTarget ?? document
  const windowTarget = options.windowTarget ?? window
  const intervalMs = options.intervalMs ?? updateCheckIntervalMs
  const checkForUpdate = () => {
    if (documentTarget.visibilityState !== 'visible') return
    void registration.update().catch(() => undefined)
  }

  checkForUpdate()
  const interval = windowTarget.setInterval(checkForUpdate, intervalMs)
  windowTarget.addEventListener('focus', checkForUpdate)
  windowTarget.addEventListener('online', checkForUpdate)
  documentTarget.addEventListener('visibilitychange', checkForUpdate)

  return () => {
    windowTarget.clearInterval(interval)
    windowTarget.removeEventListener('focus', checkForUpdate)
    windowTarget.removeEventListener('online', checkForUpdate)
    documentTarget.removeEventListener('visibilitychange', checkForUpdate)
  }
}

export async function reloadWithLatestServiceWorker(): Promise<void> {
  try {
    const serviceWorker = navigator.serviceWorker
    const registration = await serviceWorker.getRegistration()
    await registration?.update()
    const waitingWorker = registration?.waiting
    if (waitingWorker !== null && waitingWorker !== undefined) {
      const controlling = new Promise<void>((resolve) => {
        serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
      })
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      await Promise.race([
        controlling,
        new Promise<void>((resolve) => window.setTimeout(resolve, 1_500)),
      ])
    }
  } catch {
    // Reloading is still the most useful recovery when update detection itself fails.
  } finally {
    window.location.reload()
  }
}

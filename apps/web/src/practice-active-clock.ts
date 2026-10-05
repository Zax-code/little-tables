type ClockDocument = Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>

/** Measures thinking time, excluding time while the PWA is in the background. */
export function createPracticeActiveClock({
  documentTarget = document,
  initialElapsedMs = 0,
  now = () => performance.now(),
}: Readonly<{
  documentTarget?: ClockDocument
  initialElapsedMs?: number
  now?: () => number
}> = {}) {
  let elapsedMs = Math.max(0, initialElapsedMs)
  let startedAt = documentTarget.visibilityState === 'visible' ? now() : null
  let stopped = false

  const read = () =>
    Math.round(elapsedMs + (startedAt === null ? 0 : Math.max(0, now() - startedAt)))

  const visibilityChanged = () => {
    if (stopped) return
    if (documentTarget.visibilityState !== 'visible') {
      elapsedMs = read()
      startedAt = null
    } else {
      startedAt ??= now()
    }
  }

  documentTarget.addEventListener('visibilitychange', visibilityChanged)

  return {
    elapsedMs: read,
    stop: () => {
      if (!stopped) {
        elapsedMs = read()
        startedAt = null
        stopped = true
        documentTarget.removeEventListener('visibilitychange', visibilityChanged)
      }
      return elapsedMs
    },
  }
}

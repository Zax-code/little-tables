export function scheduleInitialSync(sync: () => void, delayMs = 1_500): () => void {
  const timeout = globalThis.setTimeout(sync, delayMs)
  return () => globalThis.clearTimeout(timeout)
}

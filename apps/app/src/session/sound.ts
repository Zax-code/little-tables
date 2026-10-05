/**
 * The soft two-note chime of a right answer, and a light tap on phones that vibrate. Neither
 * carries information on its own (`docs/rewrite/TECHNICAL_SPEC.md` §4.1).
 */
let context: AudioContext | null = null

const audio = () => {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (context === null || context.state === 'closed') context = new AudioContext()
  return context
}

/** Unlocks audio inside the tap that will lead to a chime (Safari requires a gesture). */
export const prepareChime = () => {
  const current = audio()
  if (current?.state === 'suspended') void current.resume().catch(() => undefined)
}

const schedule = (current: AudioContext) => {
  const gain = current.createGain()
  gain.gain.setValueAtTime(0.0001, current.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.08, current.currentTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, current.currentTime + 0.22)
  gain.connect(current.destination)
  for (const [frequency, offset] of [
    [659, 0],
    [784, 0.07],
  ] as const) {
    const oscillator = current.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(current.currentTime + offset)
    oscillator.stop(current.currentTime + offset + 0.16)
  }
}

export const playChime = () => {
  const current = audio()
  if (current === null) return
  if (current.state === 'suspended') {
    void current.resume().then(() => {
      if (current.state === 'running') schedule(current)
    })
    return
  }
  schedule(current)
}

/** A short vibration where supported; silently nothing elsewhere. */
export const tap = () => {
  try {
    navigator.vibrate?.(12)
  } catch {
    // Some browsers refuse vibration outside a gesture.
  }
}

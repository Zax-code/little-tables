const SOUND_KEY = 'little-tables:sound'

export const soundEnabled = (): boolean => localStorage.getItem(SOUND_KEY) !== 'off'

export const setSoundEnabled = (enabled: boolean): void => {
  localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
}

export const playSuccessSound = (): void => {
  if (!soundEnabled()) return
  const AudioContextConstructor = window.AudioContext
  const context = new AudioContextConstructor()
  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
  gain.connect(context.destination)
  for (const [frequency, offset] of [
    [659, 0],
    [784, 0.07],
  ] as const) {
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(context.currentTime + offset)
    oscillator.stop(context.currentTime + offset + 0.16)
  }
  window.setTimeout(() => void context.close(), 350)
}

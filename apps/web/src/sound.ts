const SOUND_KEY = 'little-tables:sound'

let audioContext: AudioContext | null = null
let resumePromise: Promise<void> | null = null

export const soundEnabled = (): boolean => localStorage.getItem(SOUND_KEY) !== 'off'

export const setSoundEnabled = (enabled: boolean): void => {
  localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
}

const getAudioContext = (): AudioContext => {
  if (audioContext === null || audioContext.state === 'closed') {
    audioContext = new window.AudioContext()
  }

  return audioContext
}

const resumeAudioContext = (context: AudioContext): Promise<void> => {
  if (context.state !== 'suspended') return Promise.resolve()
  if (resumePromise !== null) return resumePromise

  resumePromise = context
    .resume()
    .catch(() => undefined)
    .finally(() => {
      resumePromise = null
    })

  return resumePromise
}

export const prepareSuccessSound = (): void => {
  if (!soundEnabled()) return

  const context = getAudioContext()
  void resumeAudioContext(context)
}

const scheduleSuccessSound = (context: AudioContext): void => {
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
}

export const playSuccessSound = (): void => {
  if (!soundEnabled()) return

  const context = getAudioContext()
  if (context.state === 'suspended') {
    void resumeAudioContext(context).then(() => {
      if (context.state === 'running') scheduleSuccessSound(context)
    })
    return
  }

  scheduleSuccessSound(context)
}

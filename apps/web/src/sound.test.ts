import { beforeEach, describe, expect, it, vi } from 'vitest'

const contextInstances: FakeAudioContext[] = []

class FakeAudioContext {
  readonly close = vi.fn(() => Promise.resolve())
  readonly createGain = vi.fn(() => ({
    connect: vi.fn(),
    gain: {
      exponentialRampToValueAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
    },
  }))
  readonly createOscillator = vi.fn(() => ({
    connect: vi.fn(),
    frequency: { value: 0 },
    start: vi.fn(),
    stop: vi.fn(),
    type: 'sine',
  }))
  readonly currentTime = 0
  readonly destination = {}
  readonly resume = vi.fn(() => {
    this.state = 'running'
    return Promise.resolve()
  })
  state: AudioContextState = 'suspended'

  constructor() {
    contextInstances.push(this)
  }
}

describe('success sound', () => {
  beforeEach(() => {
    contextInstances.length = 0
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'on'),
      setItem: vi.fn(),
    })
    vi.stubGlobal('window', {
      AudioContext: FakeAudioContext as unknown as typeof AudioContext,
      setTimeout,
    })
  })

  it('resumes a suspended browser audio context so the effect is audible', async () => {
    const { playSuccessSound } = await import('./sound.js')

    playSuccessSound()

    expect(contextInstances).toHaveLength(1)
    expect(contextInstances[0]?.resume).toHaveBeenCalledOnce()
  })

  it('reuses the audio context and leaves it open long enough for every effect to finish', async () => {
    const { playSuccessSound } = await import('./sound.js')

    playSuccessSound()
    playSuccessSound()
    await vi.runAllTimersAsync()

    expect(contextInstances).toHaveLength(1)
    expect(contextInstances[0]?.close).not.toHaveBeenCalled()
  })
})

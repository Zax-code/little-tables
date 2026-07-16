import { describe, expect, it, vi } from 'vitest'

import { runFlowerTransition } from '../flower-transition.js'

describe('flower transition', () => {
  it('changes the page while the flower curtain is closed', async () => {
    const events: Array<string> = []

    await runFlowerTransition({
      action: () => {
        events.push('navigate')
      },
      now: () => 0,
      onPhaseChange: (phase) => events.push(phase.type),
      reduceMotion: false,
      wait: (milliseconds) => {
        events.push(`wait:${milliseconds}`)
        return Promise.resolve()
      },
    })

    expect(events).toEqual(['covering', 'wait:500', 'navigate', 'uncovering', 'wait:500', 'idle'])
  })

  it('navigates immediately when reduced motion is requested', async () => {
    const onPhaseChange = vi.fn()
    const wait = vi.fn()
    const action = vi.fn()

    await runFlowerTransition({ action, onPhaseChange, reduceMotion: true, wait })

    expect(action).toHaveBeenCalledOnce()
    expect(onPhaseChange).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it('counts navigation time within the one-second transition', async () => {
    let elapsed = 0
    const waits: Array<number> = []
    const uncoverDurations: Array<number> = []

    await runFlowerTransition({
      action: () => {
        elapsed += 125
      },
      now: () => elapsed,
      onPhaseChange: (phase) => {
        if (phase.type === 'uncovering') uncoverDurations.push(phase.duration)
      },
      reduceMotion: false,
      wait: (milliseconds) => {
        waits.push(milliseconds)
        elapsed += milliseconds
        return Promise.resolve()
      },
    })

    expect(waits).toEqual([500, 375])
    expect(uncoverDurations).toEqual([375])
    expect(elapsed).toBe(1_000)
  })
})

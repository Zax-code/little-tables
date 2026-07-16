import { describe, expect, it, vi } from 'vitest'

import { runFlowerTransition } from '../flower-transition.js'

describe('flower transition', () => {
  it('changes the page while the flower curtain is closed', async () => {
    const events: Array<string> = []

    await runFlowerTransition({
      action: () => {
        events.push('navigate')
      },
      onPhaseChange: (phase) => events.push(phase),
      reduceMotion: false,
      wait: () => {
        events.push('wait')
        return Promise.resolve()
      },
    })

    expect(events).toEqual(['covering', 'wait', 'navigate', 'uncovering', 'wait', 'idle'])
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
})

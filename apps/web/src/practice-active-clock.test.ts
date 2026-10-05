import { describe, expect, it } from 'vitest'

import { createPracticeActiveClock } from './practice-active-clock.js'

describe('active practice time', () => {
  it('excludes background time and resumes the saved thinking time', () => {
    let time = 0
    let visibility: DocumentVisibilityState = 'visible'
    const events = new EventTarget()
    const clock = createPracticeActiveClock({
      documentTarget: {
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        get visibilityState() {
          return visibility
        },
      },
      initialElapsedMs: 700,
      now: () => time,
    })
    time = 1_000
    expect(clock.elapsedMs()).toBe(1_700)
    visibility = 'hidden'
    events.dispatchEvent(new Event('visibilitychange'))
    time = 91_000
    expect(clock.elapsedMs()).toBe(1_700)
    visibility = 'visible'
    events.dispatchEvent(new Event('visibilitychange'))
    time = 93_000
    expect(clock.stop()).toBe(3_700)
    time = 95_000
    expect(clock.elapsedMs()).toBe(3_700)
    expect(clock.stop()).toBe(3_700)
  })

  it('does not start a clock for a hidden page', () => {
    let time = 0
    const events = new EventTarget()
    const clock = createPracticeActiveClock({
      documentTarget: {
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        visibilityState: 'hidden',
      },
      now: () => time,
    })
    time = 30_000
    expect(clock.stop()).toBe(0)
  })
})

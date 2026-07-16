import { describe, expect, it } from 'vitest'

import { launchPracticeSession } from './practice-session-launch.js'

describe('practice session launch', () => {
  it('saves the new session before revealing its first question through the transition', async () => {
    const events: Array<string> = []

    await launchPracticeSession({
      invalidate: () => {
        events.push('refresh')
      },
      navigate: () => {
        events.push('navigate')
      },
      persist: () => {
        events.push('save')
      },
      transition: async (navigate) => {
        events.push('transition')
        await navigate()
      },
    })

    expect(events).toEqual(['save', 'refresh', 'transition', 'navigate'])
  })
})

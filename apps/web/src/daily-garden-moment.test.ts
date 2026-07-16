import { describe, expect, it } from 'vitest'

import { dailyGardenMoment } from './daily-garden-moment.js'

describe('dailyGardenMoment', () => {
  it('keeps one deterministic garden visitor for the whole learner day', () => {
    const first = dailyGardenMoment({ bloomCount: 7, dayKey: '2026-07-16' })
    const repeated = dailyGardenMoment({ bloomCount: 7, dayKey: '2026-07-16' })

    expect(repeated).toBe(first)
  })

  it('rotates the moment across days without depending on a streak', () => {
    const moments = new Set(
      Array.from({ length: 10 }, (_, offset) =>
        dailyGardenMoment({
          bloomCount: 7,
          dayKey: `2026-07-${String(offset + 1).padStart(2, '0')}`,
        }),
      ),
    )

    expect(moments.size).toBeGreaterThan(1)
  })

  it('uses only calm ambient moments before the first bloom', () => {
    const moments = Array.from({ length: 20 }, (_, offset) =>
      dailyGardenMoment({
        bloomCount: 0,
        dayKey: `2026-06-${String(offset + 1).padStart(2, '0')}`,
      }),
    )

    expect(moments).not.toContain('butterfly')
    expect(moments).not.toContain('sunbeam')
  })
})

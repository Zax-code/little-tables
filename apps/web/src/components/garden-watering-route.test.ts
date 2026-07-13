import { describe, expect, it } from 'vitest'

import { pickNextGardenTarget, positionGardenCaretakerY } from './garden-watering-route.js'

describe('garden watering route', () => {
  it('can select every plant except the one Miffy just watered', () => {
    const selected = [0, 0.24, 0.49, 0.74, 0.999].map((randomValue) =>
      pickNextGardenTarget(2, 6, () => randomValue),
    )

    expect(new Set(selected)).toEqual(new Set([0, 1, 3, 4, 5]))
    expect(selected).not.toContain(2)
  })

  it('does not move when there is only one available plant', () => {
    expect(pickNextGardenTarget(0, 1, () => 0.75)).toBe(0)
  })

  it('keeps Miffy inside the rounded garden when watering the top row', () => {
    expect(positionGardenCaretakerY(166, 190)).toBeGreaterThanOrEqual(8)
  })
})

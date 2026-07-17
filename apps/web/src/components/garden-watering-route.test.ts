import { describe, expect, it } from 'vitest'

import {
  gardenWorldX,
  gardenWateringCycleMs,
  pickNextGardenTarget,
  selectGardenCaretakerTarget,
} from './garden-watering-route.js'

describe('garden watering route', () => {
  it('starts a new watering route every three seconds', () => {
    expect(gardenWateringCycleMs).toBe(3_000)
  })

  it('does not move when there is only one available plant', () => {
    const onlyTarget = { id: 'tulip', pageIndex: 0 }

    expect(pickNextGardenTarget(onlyTarget.id, [onlyTarget], () => 0.75)).toBe(onlyTarget)
  })

  it('keeps Miffy on her current plant when the player displays a different garden', () => {
    const targets = [
      { id: 'tulip', pageIndex: 0 },
      { id: 'lavender', pageIndex: 1 },
      { id: 'cosmos', pageIndex: 2 },
    ] as const
    const initialTarget = selectGardenCaretakerTarget(undefined, targets, () => 0.8)
    const remeasuredTargets = targets.map((target) => ({ ...target }))

    expect(initialTarget).toEqual(targets[2])
    expect(selectGardenCaretakerTarget(initialTarget?.id, remeasuredTargets, () => 0)).toEqual(
      targets[2],
    )
  })

  it('maps every garden onto one continuous world coordinate system', () => {
    expect(gardenWorldX(0, 340, 120)).toBe(120)
    expect(gardenWorldX(1, 340, 120)).toBe(460)
    expect(gardenWorldX(2, 340, 120)).toBe(800)
  })

  it('selects cross-garden destinations from the shared world', () => {
    const source = { caretakerX: 40, id: 'tulip', pageIndex: 0 }
    const sameGarden = { caretakerX: 80, id: 'daisy', pageIndex: 0 }
    const destination = { caretakerX: 800, id: 'cosmos', pageIndex: 2 }

    expect(pickNextGardenTarget(source.id, [source, sameGarden, destination], () => 0.999)).toBe(
      destination,
    )
  })
})

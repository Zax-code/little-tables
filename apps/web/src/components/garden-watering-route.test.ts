import { describe, expect, it } from 'vitest'

import {
  gardenTargetsForPage,
  pickNextGardenTarget,
  pickNextGardenTargetInGarden,
  planGardenJourney,
  selectGardenCaretakerTarget,
} from './garden-watering-route.js'

describe('garden watering route', () => {
  it('starts Miffy with targets from her displayed garden only', () => {
    const targets = [
      { id: 'tulip', pageIndex: 0 },
      { id: 'lavender', pageIndex: 1 },
      { id: 'cosmos', pageIndex: 2 },
    ] as const

    expect(gardenTargetsForPage(1, targets)).toEqual([targets[1]])
  })

  it("keeps autonomous movement inside Miffy's current garden", () => {
    const targets = [
      { id: 'tulip', pageIndex: 0 },
      { id: 'daisy', pageIndex: 0 },
      { id: 'lavender', pageIndex: 1 },
      { id: 'moonflower', pageIndex: 1 },
      { id: 'cosmos', pageIndex: 2 },
      { id: 'star-bloom', pageIndex: 2 },
    ] as const
    const selected = [0, 0.24, 0.49, 0.74, 0.999].map((randomValue) =>
      pickNextGardenTargetInGarden(targets[2], targets, () => randomValue),
    )

    expect(new Set(selected.map((target) => target?.id))).toEqual(new Set(['moonflower']))
    expect(new Set(selected.map((target) => target?.pageIndex))).toEqual(new Set([1]))
    expect(selected).not.toContainEqual(targets[2])
  })

  it('does not move when there is only one available plant', () => {
    const onlyTarget = { id: 'tulip', pageIndex: 0 }

    expect(pickNextGardenTarget(onlyTarget.id, [onlyTarget], () => 0.75)).toBe(onlyTarget)
  })

  it('does not start a walk when Miffy is the only caretaker in her garden', () => {
    const currentTarget = { id: 'tulip', pageIndex: 0 }
    const otherGardenTarget = { id: 'cosmos', pageIndex: 1 }

    expect(
      pickNextGardenTargetInGarden(currentTarget, [currentTarget, otherGardenTarget], () => 0.75),
    ).toBeUndefined()
  })

  it('keeps Miffy in her garden when the player displays a different garden', () => {
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

  it('routes Miffy out of one garden and into the next instead of teleporting', () => {
    const source = { caretakerX: 40, id: 'tulip', pageIndex: 0 }
    const destination = { caretakerX: 120, id: 'cosmos', pageIndex: 2 }

    expect(
      planGardenJourney(source, destination, { canvasWidth: 340, caretakerWidth: 190 }),
    ).toEqual({
      arrival: { caretakerX: -190, id: 'cosmos', pageIndex: 2 },
      departure: { caretakerX: 340, id: 'tulip', pageIndex: 0 },
      destination,
      direction: 'right',
      kind: 'between-gardens',
    })
  })
})

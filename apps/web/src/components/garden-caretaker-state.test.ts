import { describe, expect, it } from 'vitest'

import {
  initialGardenCaretakerState,
  transitionGardenCaretaker,
  type GardenCaretakerTarget,
} from './garden-caretaker-state.js'

const target = (id: string, pageIndex: number, caretakerX: number): GardenCaretakerTarget => ({
  caretakerX,
  caretakerY: 40,
  facing: 'right',
  id,
  pageIndex,
  waterX: caretakerX + 20,
  waterY: 120,
})

describe('garden caretaker state', () => {
  it('starts in the displayed garden and retains a cross-garden destination when remeasured', () => {
    const firstGarden = target('tulip', 0, 40)
    const displayedGarden = target('cosmos', 1, 100)
    const initial = transitionGardenCaretaker(initialGardenCaretakerState, {
      initialPage: 1,
      randomValue: 0,
      targets: [firstGarden, displayedGarden],
      type: 'targets-measured',
    })
    const arrived = { ...initial, target: firstGarden }

    expect(initial.target).toBe(displayedGarden)
    expect(
      transitionGardenCaretaker(arrived, {
        initialPage: 1,
        randomValue: 0.999,
        targets: [{ ...firstGarden }, { ...displayedGarden }],
        type: 'targets-measured',
      }).target,
    ).toEqual(firstGarden)
  })

  it('walks directly to a cross-garden target and resumes watering', () => {
    const destination = target('cosmos', 2, 800)
    const walking = transitionGardenCaretaker(initialGardenCaretakerState, {
      target: destination,
      type: 'walk',
      walkDuration: 4.5,
      walkFacing: 'right',
    })
    const watering = transitionGardenCaretaker(walking, { type: 'water' })

    expect([walking.phase, watering.phase]).toEqual(['walking', 'watering'])
    expect(walking.target).toBe(destination)
    expect(walking).not.toHaveProperty('crossGardenJourney')
    expect(watering.target).toBe(destination)
  })
})

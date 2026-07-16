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
  it('completes a cross-garden journey and resumes autonomous watering', () => {
    const source = target('tulip', 0, 340)
    const arrival = target('cosmos', 2, -190)
    const destination = target('cosmos', 2, 100)
    const journey = { arrival, destination, direction: 'right' as const }

    const departing = transitionGardenCaretaker(initialGardenCaretakerState, {
      crossGardenJourney: journey,
      target: source,
      type: 'depart',
      walkDuration: 1,
      walkFacing: 'right',
    })
    const traveling = transitionGardenCaretaker(departing, { type: 'travel' })
    const arriving = transitionGardenCaretaker(traveling, {
      target: arrival,
      type: 'arrive',
      walkDuration: 1.2,
      walkFacing: 'right',
    })
    const finishing = transitionGardenCaretaker(arriving, {
      target: destination,
      type: 'finish-arrival',
    })
    const watering = transitionGardenCaretaker(finishing, { type: 'water' })

    expect([
      departing.phase,
      traveling.phase,
      arriving.phase,
      finishing.phase,
      watering.phase,
    ]).toEqual(['departing', 'traveling', 'arriving', 'finishing-arrival', 'watering'])
    expect(traveling.target).toBeUndefined()
    expect(finishing.target).toBe(destination)
    expect(watering.crossGardenJourney).toBeUndefined()
  })
})

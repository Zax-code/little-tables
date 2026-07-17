import { describe, expect, it } from 'vitest'

import { gardenPlantVisuals } from './garden-plant-catalog.js'

describe('garden plant visual catalog', () => {
  it('provides a semantic-token visual for every domain plant', () => {
    const visuals = Object.values(gardenPlantVisuals)

    expect(visuals).toHaveLength(9)
    expect(
      visuals.every(({ accentColor, centerColor, petalColor, potColor }) =>
        [accentColor, centerColor, petalColor, potColor].every((color) =>
          color.startsWith('var(--garden-'),
        ),
      ),
    ).toBe(true)
  })

  it('contains exactly the approved nine-flower inventory', () => {
    expect(Object.keys(gardenPlantVisuals)).toEqual(
      expect.arrayContaining([
        'rose-lotus',
        'twilight-lupine',
        'velvet-foxglove',
        'plum-snapdragon',
        'sunset-zinnia',
        'ruby-bleeding-heart',
        'blushing-peony',
        'ivory-magnolia',
        'blue-wisteria',
      ]),
    )
  })
})

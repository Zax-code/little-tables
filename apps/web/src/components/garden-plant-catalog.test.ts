import { describe, expect, it } from 'vitest'

import { gardenPlantVisuals } from './garden-plant-catalog.js'

describe('garden plant visual catalog', () => {
  it('provides a semantic-token visual for every domain plant', () => {
    const visuals = Object.values(gardenPlantVisuals)

    expect(visuals.length).toBeGreaterThan(0)
    expect(
      visuals.every(({ centerColor, petalColor, potColor }) =>
        [centerColor, petalColor, potColor].every((color) => color.startsWith('var(--garden-')),
      ),
    ).toBe(true)
  })
})

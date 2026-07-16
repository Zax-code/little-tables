import { describe, expect, it } from 'vitest'

import { gardenPlantVisuals } from './garden-plant-catalog.js'

describe('garden plant visual catalog', () => {
  it('provides a semantic-token visual for every domain plant', () => {
    const visuals = Object.values(gardenPlantVisuals)

    expect(visuals).toHaveLength(18)
    expect(
      visuals.every(({ centerColor, petalColor, potColor }) =>
        [centerColor, petalColor, potColor].every((color) => color.startsWith('var(--garden-')),
      ),
    ).toBe(true)
  })

  it('gives every finite garden chapter six distinct plant skins', () => {
    expect(Object.keys(gardenPlantVisuals)).toEqual(
      expect.arrayContaining([
        'coral-tulip',
        'sunny-daisy',
        'red-tulip',
        'cloud-daisy',
        'blush-tulip',
        'celebration-daisy',
        'lavender-sprig',
        'golden-marigold',
        'violet-pansy',
        'white-cosmos',
        'ruby-poppy',
        'moonflower',
        'mint-hydrangea',
        'peach-dahlia',
        'star-jasmine',
        'indigo-iris',
        'rose-camellia',
        'sunset-sunflower',
      ]),
    )
  })
})

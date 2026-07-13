import type { GardenPlantId, GardenPlantProgress } from '@little-tables/domain'

import type { GardenPlantKind } from './garden-plant-renderers.js'

export type { GardenPlantKind } from './garden-plant-renderers.js'

type GardenPlantVisual = Readonly<{
  centerColor: string
  kind: GardenPlantKind
  petalColor: string
  potColor: string
}>

export type GardenPlantDefinition = GardenPlantProgress & GardenPlantVisual

// To add a plant with an existing silhouette, add its growth milestone in the
// domain and its visual skin here; plot, animation, reward, lock, and a11y behavior
// then derive automatically. A brand-new silhouette also needs one mature/bud/
// reward renderer entry in garden-plant-renderers.tsx, reusable by every skin.
export const gardenPlantVisuals: Readonly<Record<GardenPlantId, GardenPlantVisual>> = {
  'blush-tulip': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'tulip',
    petalColor: 'var(--garden-bloom-pink)',
    potColor: 'var(--garden-pot-pink)',
  },
  'celebration-daisy': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-soft-pink)',
    potColor: 'var(--garden-pot-pink)',
  },
  'cloud-daisy': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-cream)',
    potColor: 'var(--garden-pot-pink)',
  },
  'coral-tulip': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'tulip',
    petalColor: 'var(--garden-bloom-coral)',
    potColor: 'var(--garden-pot-pink)',
  },
  'red-tulip': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'tulip',
    petalColor: 'var(--garden-bloom-red)',
    potColor: 'var(--garden-pot-pink)',
  },
  'sunny-daisy': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-white)',
    potColor: 'var(--garden-pot-pink)',
  },
}

export function gardenPlantDefinition(plant: GardenPlantProgress): GardenPlantDefinition {
  return { ...plant, ...gardenPlantVisuals[plant.id] }
}

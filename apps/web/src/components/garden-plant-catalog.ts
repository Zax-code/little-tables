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
  'golden-marigold': {
    centerColor: 'var(--garden-center-russet)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-gold)',
    potColor: 'var(--garden-pot-gold)',
  },
  'indigo-iris': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'tulip',
    petalColor: 'var(--garden-bloom-indigo)',
    potColor: 'var(--garden-pot-indigo)',
  },
  'lavender-sprig': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'tulip',
    petalColor: 'var(--garden-bloom-lavender)',
    potColor: 'var(--garden-pot-lilac)',
  },
  'mint-hydrangea': {
    centerColor: 'var(--garden-center-cream)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-mint)',
    potColor: 'var(--garden-pot-mint)',
  },
  moonflower: {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-moon)',
    potColor: 'var(--garden-pot-indigo)',
  },
  'peach-dahlia': {
    centerColor: 'var(--garden-center-russet)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-peach)',
    potColor: 'var(--garden-pot-peach)',
  },
  'red-tulip': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'tulip',
    petalColor: 'var(--garden-bloom-red)',
    potColor: 'var(--garden-pot-pink)',
  },
  'rose-camellia': {
    centerColor: 'var(--garden-center-cream)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-rose)',
    potColor: 'var(--garden-pot-pink)',
  },
  'ruby-poppy': {
    centerColor: 'var(--garden-center-russet)',
    kind: 'tulip',
    petalColor: 'var(--garden-bloom-ruby)',
    potColor: 'var(--garden-pot-gold)',
  },
  'star-jasmine': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-star)',
    potColor: 'var(--garden-pot-mint)',
  },
  'sunny-daisy': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-white)',
    potColor: 'var(--garden-pot-pink)',
  },
  'sunset-sunflower': {
    centerColor: 'var(--garden-center-russet)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-sunset)',
    potColor: 'var(--garden-pot-peach)',
  },
  'violet-pansy': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'tulip',
    petalColor: 'var(--garden-bloom-violet)',
    potColor: 'var(--garden-pot-lilac)',
  },
  'white-cosmos': {
    centerColor: 'var(--garden-center-yellow)',
    kind: 'daisy',
    petalColor: 'var(--garden-bloom-white)',
    potColor: 'var(--garden-pot-mint)',
  },
}

export function gardenPlantDefinition(plant: GardenPlantProgress): GardenPlantDefinition {
  return { ...plant, ...gardenPlantVisuals[plant.id] }
}

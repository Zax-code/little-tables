import type { GardenPlantId, GardenPlantProgress } from '@little-tables/domain'

import type { GardenPlantKind } from './garden-plant-renderers.js'

export type { GardenPlantKind } from './garden-plant-renderers.js'

type GardenPlantVisual = Readonly<{
  accentColor: string
  centerColor: string
  kind: GardenPlantKind
  petalColor: string
  potColor: string
}>

export type GardenPlantDefinition = GardenPlantProgress & GardenPlantVisual

// Domain milestones own progression; this catalog owns the semantic colors and
// renderer identity for each approved silhouette.
export const gardenPlantVisuals: Readonly<Record<GardenPlantId, GardenPlantVisual>> = {
  'rose-lotus': {
    accentColor: 'var(--garden-bloom-soft-pink)',
    centerColor: 'var(--garden-bloom-peach)',
    kind: 'rose-lotus',
    petalColor: 'var(--garden-bloom-rose)',
    potColor: 'var(--garden-pot-pink)',
  },
  'twilight-lupine': {
    accentColor: 'var(--garden-bloom-lavender)',
    centerColor: 'var(--garden-center-cream)',
    kind: 'twilight-lupine',
    petalColor: 'var(--garden-bloom-indigo)',
    potColor: 'var(--garden-pot-indigo)',
  },
  'velvet-foxglove': {
    accentColor: 'var(--garden-bloom-lavender)',
    centerColor: 'var(--garden-center-cream)',
    kind: 'velvet-foxglove',
    petalColor: 'var(--garden-bloom-violet)',
    potColor: 'var(--garden-pot-lilac)',
  },
  'plum-snapdragon': {
    accentColor: 'var(--garden-bloom-lavender)',
    centerColor: 'var(--garden-center-cream)',
    kind: 'plum-snapdragon',
    petalColor: 'var(--garden-bloom-violet)',
    potColor: 'var(--garden-pot-lilac)',
  },
  'sunset-zinnia': {
    accentColor: 'var(--garden-bloom-peach)',
    centerColor: 'var(--garden-center-russet)',
    kind: 'sunset-zinnia',
    petalColor: 'var(--garden-bloom-violet)',
    potColor: 'var(--garden-pot-peach)',
  },
  'ruby-bleeding-heart': {
    accentColor: 'var(--garden-bloom-soft-pink)',
    centerColor: 'var(--garden-center-cream)',
    kind: 'ruby-bleeding-heart',
    petalColor: 'var(--garden-bloom-ruby)',
    potColor: 'var(--garden-pot-pink)',
  },
  'blushing-peony': {
    accentColor: 'var(--garden-bloom-peach)',
    centerColor: 'var(--garden-center-russet)',
    kind: 'blushing-peony',
    petalColor: 'var(--garden-bloom-rose)',
    potColor: 'var(--garden-pot-pink)',
  },
  'ivory-magnolia': {
    accentColor: 'var(--garden-bloom-gold)',
    centerColor: 'var(--garden-center-russet)',
    kind: 'ivory-magnolia',
    petalColor: 'var(--garden-bloom-cream)',
    potColor: 'var(--garden-pot-gold)',
  },
  'blue-wisteria': {
    accentColor: 'var(--garden-bloom-lavender)',
    centerColor: 'var(--garden-center-cream)',
    kind: 'blue-wisteria',
    petalColor: 'var(--garden-bloom-indigo)',
    potColor: 'var(--garden-pot-indigo)',
  },
}

export function gardenPlantDefinition(plant: GardenPlantProgress): GardenPlantDefinition {
  return { ...plant, ...gardenPlantVisuals[plant.id] }
}

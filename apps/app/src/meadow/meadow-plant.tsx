/** A verb's flower in its pot: a seed, a bud or the flower of its silhouette and palette. */
import type { MeadowStage, MeadowVerb } from '@little-tables/engine/schema'
import { cn } from '@little-tables/ui'

import { GardenPlantPot, gardenPlantViewBox } from '../garden/garden-plant-illustration.js'
import { MeadowBud, MeadowHead, type MeadowColors } from './meadow-plant-renderers.js'

const ink = 'var(--ink-primary)'

type Body = Readonly<{ leafDeep: string; leafLight: string; stem: string }>

const bodies: Readonly<Record<MeadowStage, Body>> = {
  growing: {
    leafDeep: 'M72 144c17-17 30-14 32-9-7 13-19 16-32 15z',
    leafLight: 'M68 136c-17-15-30-12-32-7 7 14 18 18 32 17z',
    stem: 'M70 154v-50',
  },
  mature: {
    leafDeep: 'M72 143c18-19 32-15 34-10-8 14-20 17-34 17z',
    leafLight: 'M68 134c-19-17-33-13-35-8 7 16 20 20 35 19z',
    stem: 'M70 154v-57',
  },
  seed: {
    leafDeep: 'M71 145c11-13 21-11 22-7-4 9-12 12-22 12z',
    leafLight: 'M69 139c-12-12-22-10-23-6 5 10 13 13 23 13z',
    stem: 'M70 154v-30',
  },
}

function MeadowBody({ stage }: Readonly<{ stage: MeadowStage }>) {
  const body = bodies[stage]
  return (
    <g stroke={ink} strokeLinecap="round" strokeLinejoin="round" transform="scale(.8)">
      <path d={body.stem} fill="none" strokeWidth="2.4" />
      <path d={body.leafLight} fill="var(--meadow-leaf-light)" strokeWidth="2" />
      <path d={body.leafDeep} fill="var(--meadow-leaf-deep)" strokeWidth="2" />
    </g>
  )
}

type MeadowPlantProps = Readonly<{
  className?: string
  /** Spoken description; the plant is decorative without it. */
  label?: string
  verb: Pick<MeadowVerb, 'palette' | 'silhouette' | 'stage'>
}>

/** Same API as the garden's `Plant`. */
export function MeadowPlant({ className, label, verb }: MeadowPlantProps) {
  const colors: MeadowColors = {
    accent: `var(--meadow-${verb.palette}-accent)`,
    center: `var(--meadow-${verb.palette}-center)`,
    petal: `var(--meadow-${verb.palette}-petal)`,
  }
  return (
    <svg
      aria-hidden={label === undefined}
      aria-label={label}
      className={cn('overflow-visible', className)}
      data-meadow-plant={`${verb.silhouette}-${verb.stage}`}
      role={label === undefined ? undefined : 'img'}
      viewBox={gardenPlantViewBox}
    >
      <MeadowBody stage={verb.stage} />
      {verb.stage === 'mature' ? <MeadowHead silhouette={verb.silhouette} {...colors} /> : null}
      {verb.stage === 'growing' ? <MeadowBud {...colors} /> : null}
      <GardenPlantPot color={`var(--meadow-${verb.palette}-pot)`} />
    </svg>
  )
}

import type { GardenPlantProgress } from '@little-tables/engine/schema'
import { cn } from '@little-tables/ui'

import { gardenPlantDefinition } from './garden-plant-catalog.js'
import {
  GardenPlantArtwork,
  GardenPlantPot,
  gardenPlantViewBox,
} from './garden-plant-illustration.js'

/** An empty pot with a padlock: the plant is still to unlock (redesign of the garden). */
function LockedPot() {
  return (
    <>
      <GardenPlantPot color="var(--garden-lock-surface)" />
      <g transform="translate(56 103)">
        <path
          d="M-7 -4V-9C-7 -14 7 -14 7 -9V-4"
          fill="none"
          stroke="var(--garden-lock-line)"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <rect
          fill="var(--garden-lock-surface)"
          height="14"
          rx="3.5"
          stroke="var(--garden-lock-line)"
          strokeWidth="2.5"
          width="20"
          x="-10"
          y="-4"
        />
        <circle cx="0" cy="3" fill="var(--garden-lock-ink)" r="2" />
      </g>
    </>
  )
}

type PlantProps = Readonly<{
  className?: string
  /** Spoken description; the plant is decorative without it. */
  label?: string
  plant: GardenPlantProgress
}>

/** A plant in its pot at its current stage, or a locked pot. */
export function Plant({ className, label, plant }: PlantProps) {
  return (
    <svg
      aria-hidden={label === undefined}
      aria-label={label}
      className={cn('overflow-visible', className)}
      role={label === undefined ? undefined : 'img'}
      viewBox={gardenPlantViewBox}
    >
      {plant.stage === 'locked' ? (
        <LockedPot />
      ) : (
        <GardenPlantArtwork definition={gardenPlantDefinition(plant)} stage={plant.stage} />
      )}
    </svg>
  )
}

import { cn } from '@little-tables/ui'
import { useReducedMotion } from 'motion/react'

import { sceneOf, type CharacterId } from './characters.js'

type SpriteProps = Readonly<{
  character: CharacterId
  className?: string
  /** Faces left by mirroring the sheet. */
  flipped?: boolean
  label?: string
  motion: 'celebration' | 'walk' | 'water'
}>

/** An animated character from its sprite sheet; still with reduced motion. */
export function Sprite({ character, className, flipped = false, label, motion }: SpriteProps) {
  const reduced = useReducedMotion() === true
  const scene = sceneOf(
    character,
    motion === 'celebration' ? 'celebration' : motion === 'walk' ? 'gardenWalk' : 'gardenWater',
  )
  return (
    <div
      aria-hidden={label === undefined}
      aria-label={label}
      className={cn(
        'aspect-square overflow-hidden',
        motion === 'celebration' && !reduced && 'sprite-hop',
        className,
      )}
      role={label === undefined ? undefined : 'img'}
      style={flipped ? { transform: 'scaleX(-1)' } : undefined}
    >
      <span
        className={cn('sprite-sheet', `sprite-${motion}`, reduced && 'sprite-still')}
        style={{ backgroundImage: `url(${scene.src})` }}
      />
    </div>
  )
}

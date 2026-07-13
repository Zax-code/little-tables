import { useReducedMotion } from 'motion/react'

import { celebrationSprite } from '../assets.js'

export function CelebrationSprite() {
  const reduceMotion = useReducedMotion() === true

  return (
    <div
      aria-label={celebrationSprite.alt}
      className={`celebration-sprite${reduceMotion ? ' celebration-sprite--static' : ''}`}
      role="img"
    >
      <span
        aria-hidden="true"
        className="celebration-sprite__sheet"
        style={{ backgroundImage: `url(${celebrationSprite.src})` }}
      />
    </div>
  )
}

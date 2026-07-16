import { useReducedMotion } from 'motion/react'

import { celebrationSprite } from '../assets.js'
import { useI18n } from '../i18n.js'

export function CelebrationSprite() {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion() === true

  return (
    <div
      aria-label={t(celebrationSprite.altKey)}
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

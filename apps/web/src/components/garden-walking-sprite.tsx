import { gardenWalkingSprite } from '../assets.js'
import { useI18n } from '../i18n.js'

type GardenWalkingSpriteProps = Readonly<{
  facing: 'left' | 'right'
}>

export function GardenWalkingSprite({ facing }: GardenWalkingSpriteProps) {
  const { t } = useI18n()
  return (
    <div
      aria-label={t(gardenWalkingSprite.altKey)}
      className={`garden-walking-sprite garden-walking-sprite--facing-${facing}`}
      role="img"
    >
      <span
        aria-hidden="true"
        className="garden-walking-sprite__sheet"
        style={{ backgroundImage: `url(${gardenWalkingSprite.src})` }}
      />
    </div>
  )
}

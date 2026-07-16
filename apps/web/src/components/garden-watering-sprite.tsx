import { gardenWateringSprite } from '../assets.js'
import { useI18n } from '../i18n.js'

type GardenWateringSpriteProps = Readonly<{
  facing: 'left' | 'right'
  reduceMotion: boolean
}>

export function GardenWateringSprite({ facing, reduceMotion }: GardenWateringSpriteProps) {
  const { t } = useI18n()
  return (
    <div
      aria-label={t(gardenWateringSprite.altKey)}
      className={`garden-watering-sprite garden-watering-sprite--facing-${facing}${reduceMotion ? ' garden-watering-sprite--static' : ''}`}
      role="img"
    >
      <span
        aria-hidden="true"
        className="garden-watering-sprite__sheet"
        style={{ backgroundImage: `url(${gardenWateringSprite.src})` }}
      />
    </div>
  )
}

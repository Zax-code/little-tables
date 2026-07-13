import { gardenWateringSprite } from '../assets.js'

type GardenWateringSpriteProps = Readonly<{
  reduceMotion: boolean
}>

export function GardenWateringSprite({ reduceMotion }: GardenWateringSpriteProps) {
  return (
    <div
      aria-label={gardenWateringSprite.alt}
      className={`garden-watering-sprite${reduceMotion ? ' garden-watering-sprite--static' : ''}`}
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

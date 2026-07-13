import { gardenWateringSprite } from '../assets.js'

type GardenWateringSpriteProps = Readonly<{
  facing: 'left' | 'right'
  reduceMotion: boolean
}>

export function GardenWateringSprite({ facing, reduceMotion }: GardenWateringSpriteProps) {
  return (
    <div
      aria-label={gardenWateringSprite.alt}
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

import { gardenWalkingSprite } from '../assets.js'

type GardenWalkingSpriteProps = Readonly<{
  facing: 'left' | 'right'
}>

export function GardenWalkingSprite({ facing }: GardenWalkingSpriteProps) {
  return (
    <div
      aria-label={gardenWalkingSprite.alt}
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

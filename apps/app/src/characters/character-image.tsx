import { cn } from '@little-tables/ui'
import { useState } from 'react'

import { sceneOf, type CharacterId, type SceneId } from './characters.js'

type CharacterImageProps = Readonly<{
  alt: string
  character: CharacterId
  className?: string
  /** Loads at once: the image is on screen when the page opens. */
  eager?: boolean
  scene: SceneId
}>

/** A character's illustration; Miffy's stands in when an image cannot be loaded. */
export function CharacterImage({
  alt,
  character,
  className,
  eager = false,
  scene,
}: CharacterImageProps) {
  const [failed, setFailed] = useState<CharacterId | null>(null)
  const shown = failed === character ? 'miffy' : character
  const image = sceneOf(shown, scene)
  return (
    <img
      alt={alt}
      className={cn('select-none object-contain', className)}
      decoding="async"
      draggable={false}
      height={image.height}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => {
        if (shown !== 'miffy') setFailed(character)
      }}
      src={image.src}
      width={image.width}
    />
  )
}

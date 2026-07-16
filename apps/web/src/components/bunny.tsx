import { m, useReducedMotion } from 'motion/react'

import { characterAssets, type CharacterScene } from '../assets.js'

type BunnyProps = Readonly<{
  className?: string
  scene: CharacterScene
}>

export function Bunny({ className, scene }: BunnyProps) {
  const asset = characterAssets[scene]
  const reduceMotion = useReducedMotion() === true
  return (
    <m.img
      alt={asset.alt}
      className={className}
      initial={false}
      animate={reduceMotion ? { rotate: 0, y: 0 } : { y: [0, -2, 0] }}
      src={asset.src}
      transition={{
        duration: reduceMotion ? 0 : 2.8,
        repeat: reduceMotion ? 0 : scene === 'home' ? Infinity : 0,
      }}
    />
  )
}

import { motion, useReducedMotion } from 'motion/react'

import { characterAssets, type CharacterScene } from '../assets.js'

type BunnyProps = Readonly<{
  className?: string
  scene: CharacterScene
}>

export function Bunny({ className, scene }: BunnyProps) {
  const asset = characterAssets[scene]
  const reduceMotion = useReducedMotion() === true
  return (
    <motion.img
      alt={asset.alt}
      className={className}
      initial={false}
      animate={
        reduceMotion
          ? { rotate: 0, y: 0 }
          : scene === 'celebration'
            ? { y: [0, -12, 0], rotate: [0, -1, 1, 0] }
            : scene === 'garden'
              ? { rotate: [0, -1.5, 1.5, 0] }
              : { y: [0, -2, 0] }
      }
      src={asset.src}
      transition={{
        duration: reduceMotion ? 0 : scene === 'celebration' ? 0.72 : 2.8,
        repeat: reduceMotion ? 0 : scene === 'home' ? Infinity : 0,
      }}
    />
  )
}

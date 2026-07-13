import { motion } from 'motion/react'

import { characterAssets, type CharacterScene } from '../assets.js'

type BunnyProps = Readonly<{
  className?: string
  scene: CharacterScene
}>

export function Bunny({ className, scene }: BunnyProps) {
  const asset = characterAssets[scene]
  return (
    <motion.img
      alt={asset.alt}
      className={className}
      initial={false}
      animate={
        scene === 'celebration'
          ? { y: [0, -12, 0], rotate: [0, -1, 1, 0] }
          : scene === 'garden'
            ? { rotate: [0, -1.5, 1.5, 0] }
            : { y: [0, -2, 0] }
      }
      src={asset.src}
      transition={{
        duration: scene === 'celebration' ? 0.72 : 2.8,
        repeat: scene === 'home' ? Infinity : 0,
      }}
    />
  )
}

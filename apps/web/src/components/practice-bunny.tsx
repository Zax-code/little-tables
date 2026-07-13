import { motion, useReducedMotion } from 'motion/react'

import { characterAssets, type CharacterScene } from '../assets.js'

export type PracticeReaction = 'correct' | 'encourage' | 'idle'

type PracticeBunnyProps = Readonly<{
  className?: string
  reaction: PracticeReaction
}>

const reactionScenes: Readonly<Record<PracticeReaction, CharacterScene>> = {
  correct: 'practiceCorrect',
  encourage: 'practiceEncourage',
  idle: 'practice',
}

export function PracticeBunny({ className = '', reaction }: PracticeBunnyProps) {
  const reduceMotion = useReducedMotion()
  const asset = characterAssets[reactionScenes[reaction]]
  const reacting = reaction !== 'idle'

  return (
    <div className={`practice-bunny-slot practice-bunny-${reaction} ${className}`.trim()}>
      <motion.img
        alt={asset.alt}
        className="practice-bunny-asset"
        initial={reduceMotion || !reacting ? false : { opacity: 0, scale: 0.86, y: 72 }}
        animate={
          reduceMotion
            ? { opacity: 1 }
            : reacting
              ? { opacity: 1, scale: [0.86, 1.04, 1], y: [72, -12, 0] }
              : { y: [0, -2, 0] }
        }
        src={asset.src}
        transition={
          reacting
            ? { duration: 0.48, ease: 'easeOut', times: [0, 0.72, 1] }
            : { duration: 2.8, repeat: Infinity }
        }
      />
    </div>
  )
}

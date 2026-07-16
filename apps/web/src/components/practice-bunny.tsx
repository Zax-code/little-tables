import { m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

import { characterAssets, type CharacterScene } from '../assets.js'
import { useI18n } from '../i18n.js'

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
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const asset = characterAssets[reactionScenes[reaction]]
  const reacting = reaction !== 'idle'
  const reactionInitial = reaction === 'correct' ? { scale: 0.88, y: 68 } : { scale: 0.96, y: 60 }

  useEffect(() => {
    if (reaction !== 'idle') return

    for (const scene of ['practiceCorrect', 'practiceEncourage'] as const) {
      const image = new Image()
      image.src = characterAssets[scene].src
      void image.decode().catch(() => undefined)
    }
  }, [reaction])

  return (
    <div className={`practice-bunny-slot practice-bunny-${reaction} ${className}`.trim()}>
      <m.img
        alt={t(asset.altKey)}
        className="practice-bunny-asset"
        initial={reduceMotion || !reacting ? false : reactionInitial}
        animate={
          reduceMotion
            ? { scale: 1, y: 0 }
            : reaction === 'correct'
              ? { scale: [0.88, 1.025, 1], y: [68, -9, 0] }
              : reaction === 'encourage'
                ? { scale: 1, y: 0 }
                : { y: [0, -2, 0] }
        }
        fetchPriority={reacting ? 'high' : 'auto'}
        loading="eager"
        src={asset.src}
        transition={
          reaction === 'correct'
            ? { duration: 0.82, ease: [0.22, 0.8, 0.24, 1], times: [0, 0.78, 1] }
            : reaction === 'encourage'
              ? { duration: 0.88, ease: [0.16, 0.74, 0.24, 1] }
              : { duration: 2.8, repeat: Infinity }
        }
      />
    </div>
  )
}

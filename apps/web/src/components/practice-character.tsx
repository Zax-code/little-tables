import { m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

import type { CharacterSceneId } from '../character-catalog.js'
import { useI18n } from '../i18n.js'
import { preloadImageSources } from '../preload-images.js'
import { useCharacterAssetFallback } from '../use-character-asset-fallback.js'
import { useSelectedCharacter } from '../use-selected-character.js'

export type PracticeReaction = 'correct' | 'encourage' | 'idle'

type PracticeCharacterProps = Readonly<{
  className?: string
  reaction: PracticeReaction
}>

const reactionScenes = {
  correct: 'practiceCorrect',
  encourage: 'practiceEncourage',
  idle: 'practiceIdle',
} as const satisfies Readonly<Record<PracticeReaction, CharacterSceneId>>

export function PracticeCharacter({ className = '', reaction }: PracticeCharacterProps) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const character = useSelectedCharacter()
  const sceneId = reactionScenes[reaction]
  const visual = useCharacterAssetFallback(sceneId)
  const asset = visual.asset
  const correctSource = character.scene('practiceCorrect').src
  const encourageSource = character.scene('practiceEncourage').src
  const reacting = reaction !== 'idle'
  const reactionInitial = reaction === 'correct' ? { scale: 0.88, y: 68 } : { scale: 0.96, y: 60 }

  useEffect(() => {
    if (reaction !== 'idle') return
    void preloadImageSources([correctSource, encourageSource])
  }, [correctSource, encourageSource, reaction])

  if (visual.showRetry) {
    return (
      <div
        className={`practice-bunny-slot practice-bunny-${reaction} ${className}`.trim()}
        data-character={character.id}
      >
        <button className="character-asset-retry" onClick={visual.retry} type="button">
          {t('asset.retry')}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`practice-bunny-slot practice-bunny-${reaction} ${className}`.trim()}
      data-character={character.id}
    >
      <m.img
        alt={t(asset.altKey, { character: visual.characterName })}
        animate={
          reduceMotion
            ? { scale: 1, y: 0 }
            : reaction === 'correct'
              ? { scale: [0.88, 1.025, 1], y: [68, -9, 0] }
              : reaction === 'encourage'
                ? { scale: 1, y: 0 }
                : { y: [0, -2, 0] }
        }
        className="practice-bunny-asset"
        draggable={false}
        fetchPriority={reacting ? 'high' : 'auto'}
        height={asset.height}
        initial={reduceMotion || !reacting ? false : reactionInitial}
        key={visual.key}
        loading="eager"
        onError={visual.onError}
        src={asset.src}
        transition={
          reaction === 'correct'
            ? { duration: 0.82, ease: [0.22, 0.8, 0.24, 1], times: [0, 0.78, 1] }
            : reaction === 'encourage'
              ? { duration: 0.88, ease: [0.16, 0.74, 0.24, 1] }
              : { duration: 2.8, repeat: Infinity }
        }
        width={asset.width}
      />
    </div>
  )
}

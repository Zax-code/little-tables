import { m, useReducedMotion } from 'motion/react'

import {
  safeMiffyCharacter,
  type CharacterAsset,
  type CharacterSceneId,
} from '../character-catalog.js'
import { useI18n } from '../i18n.js'
import { useCharacterAssetFallback } from '../use-character-asset-fallback.js'

type CharacterIllustrationProps = Readonly<{
  className?: string | undefined
  scene: CharacterSceneId
}>

function AnimatedIllustration({
  asset,
  assetKey,
  characterName,
  className,
  onError,
  scene,
}: CharacterIllustrationProps &
  Readonly<{
    asset: CharacterAsset
    assetKey?: string | undefined
    characterName: string
    onError?: (() => void) | undefined
  }>) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion() === true

  return (
    <m.img
      alt={t(asset.altKey, { character: characterName })}
      animate={reduceMotion ? { rotate: 0, y: 0 } : { y: [0, -2, 0] }}
      className={className}
      draggable={false}
      height={asset.height}
      initial={false}
      key={assetKey}
      onError={onError}
      src={asset.src}
      transition={{
        duration: reduceMotion ? 0 : 2.8,
        repeat: reduceMotion ? 0 : scene === 'home' ? Infinity : 0,
      }}
      width={asset.width}
    />
  )
}

export function CharacterIllustration({ className, scene }: CharacterIllustrationProps) {
  const { t } = useI18n()
  const visual = useCharacterAssetFallback(scene)
  if (visual.showRetry) {
    return (
      <button
        className={`${className ?? ''} character-asset-retry`.trim()}
        onClick={visual.retry}
        type="button"
      >
        {t('asset.retry')}
      </button>
    )
  }

  return (
    <AnimatedIllustration
      asset={visual.asset}
      assetKey={visual.key}
      characterName={visual.characterName}
      className={className}
      onError={visual.onError}
      scene={scene}
    />
  )
}

export function SafeMiffyIllustration({ className, scene }: CharacterIllustrationProps) {
  const { t } = useI18n()
  return (
    <AnimatedIllustration
      asset={safeMiffyCharacter.scenes[scene]}
      characterName={t(safeMiffyCharacter.displayNameKey)}
      className={className}
      scene={scene}
    />
  )
}

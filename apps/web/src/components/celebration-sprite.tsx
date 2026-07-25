import { useReducedMotion } from 'motion/react'

import { useI18n } from '../i18n.js'
import { useCharacterAssetFallback } from '../use-character-asset-fallback.js'

export function CelebrationSprite() {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion() === true
  const visual = useCharacterAssetFallback('celebration')
  const asset = visual.asset

  return (
    <div
      aria-label={t(asset.altKey, { character: visual.characterName })}
      className={`celebration-sprite${reduceMotion ? ' celebration-sprite--static' : ''}`}
      data-character={visual.selectedCharacterId}
      role={visual.showRetry ? 'group' : 'img'}
    >
      {visual.showRetry ? (
        <button className="character-asset-retry" onClick={visual.retry} type="button">
          {t('asset.retry')}
        </button>
      ) : (
        <>
          <img
            alt=""
            aria-hidden="true"
            className="character-asset-probe"
            draggable={false}
            key={visual.key}
            onError={visual.onError}
            src={asset.src}
          />
          <span
            aria-hidden="true"
            className="celebration-sprite__sheet"
            style={{ backgroundImage: `url(${asset.src})` }}
          />
        </>
      )}
    </div>
  )
}

import { useI18n } from '../i18n.js'
import { useCharacterAssetFallback } from '../use-character-asset-fallback.js'

type GardenWalkingSpriteProps = Readonly<{
  facing: 'left' | 'right'
}>

export function GardenWalkingSprite({ facing }: GardenWalkingSpriteProps) {
  const { t } = useI18n()
  const visual = useCharacterAssetFallback('gardenWalk')
  const asset = visual.asset
  return (
    <div
      aria-label={t(asset.altKey, { character: visual.characterName })}
      className={`garden-walking-sprite garden-walking-sprite--facing-${facing}`}
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
            className="garden-walking-sprite__sheet"
            style={{ backgroundImage: `url(${asset.src})` }}
          />
        </>
      )}
    </div>
  )
}

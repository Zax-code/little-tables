import { LearningEngine } from '@little-tables/domain'
import type { GardenPlantProgress } from '@little-tables/domain'
import { Link } from '@tanstack/react-router'

import { gardenPlantDefinition } from '../components/garden-plant-catalog.js'
import { GardenPlantArtwork, gardenPlantViewBox } from '../components/garden-plant-illustration.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { translatePlantName, useI18n } from '../i18n.js'

type CollectionStage = 'growing' | 'locked' | 'mature'

const chapterNameKey = (chapterId: string) => {
  if (chapterId === 'secret-greenhouse') return 'chapter.secret-greenhouse' as const
  if (chapterId === 'starlit-garden') return 'chapter.starlit-garden' as const
  return 'chapter.sunny-meadow' as const
}

const collectionStage = (plant: GardenPlantProgress): CollectionStage =>
  plant.stage === 'mature' ? 'mature' : plant.stage === 'growing' ? 'growing' : 'locked'

const collectionStatusKey = (stage: CollectionStage) =>
  stage === 'mature'
    ? ('collection.statusMature' as const)
    : stage === 'growing'
      ? ('collection.statusGrowing' as const)
      : ('collection.statusLocked' as const)

function CollectionPlantPortrait({ plant }: Readonly<{ plant: GardenPlantProgress }>) {
  const definition = gardenPlantDefinition(plant)
  const stage = collectionStage(plant)

  if (stage === 'locked') {
    return (
      <svg aria-hidden="true" className="collection-plant__portrait" viewBox="0 0 112 104">
        <>
          <path
            className="collection-plant__locked-outline"
            d="M35 91V59C35 37 44 22 56 22S77 37 77 59V91Z"
          />
          <g className="collection-plant__lock">
            <rect x="46" y="54" width="20" height="18" rx="4" />
            <path d="M50 54v-6a6 6 0 0 1 12 0v6" />
          </g>
          <path
            className="collection-plant__pot"
            d="M31 86H81L77 101c-13 4-29 4-42 0Z"
            fill={definition.potColor}
          />
        </>
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className="collection-plant__portrait" viewBox={gardenPlantViewBox}>
      <GardenPlantArtwork definition={definition} stage={stage} />
    </svg>
  )
}

export function GardenCollectionScreen() {
  const { locale, t } = useI18n()
  const bootstrap = useLocalBootstrap()
  const data = bootstrap.data
  const previewValue = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('blooms')
    : null
  const previewNumber = previewValue === null ? Number.NaN : Number(previewValue)
  const progress = LearningEngine.deriveGardenProgress({
    awardedFlowerIds: data?.gardenCollection.awardedFlowerIds,
    completedSessions: Number.isFinite(previewNumber)
      ? previewNumber
      : (data?.gardenBloomCount ?? data?.completedSessions ?? 0),
    flowerOrder: data?.gardenCollection.flowerOrder,
    snapshot: data?.snapshot ?? LearningEngine.emptySnapshot(),
  })
  const foundCountKey =
    progress.collection.collectedCount === 1
      ? 'collection.foundCountOne'
      : 'collection.foundCountMany'

  return (
    <section className="collection-screen">
      <header className="collection-heading">
        <Link className="collection-back-link" to="/garden">
          {t('collection.back')}
        </Link>
        <p className="eyebrow">{t('chapter.heading')}</p>
        <h1>{t('collection.heading')}</h1>
        <p>{t('collection.intro')}</p>
        <strong>
          {t(foundCountKey, {
            count: progress.collection.collectedCount,
          })}
        </strong>
      </header>

      {progress.collection.collectedCount === 0 ? (
        <p className="collection-empty">{t('collection.empty')}</p>
      ) : null}

      <div className="collection-chapters">
        {progress.chapters.map((chapter) => (
          <section className="collection-chapter" key={chapter.id}>
            <header>
              <div>
                <p>{t('chapter.heading')}</p>
                <h2>{t(chapterNameKey(chapter.id))}</h2>
              </div>
              <span>
                {t('chapter.progress', {
                  current: chapter.collectedCount,
                  flower: t(chapter.collectedCount === 1 ? 'common.flower' : 'common.flowers'),
                  total: chapter.totalCount,
                })}
              </span>
            </header>
            <ul className="collection-grid">
              {chapter.plants.map((plant) => {
                const stage = collectionStage(plant)
                const name = translatePlantName(locale, plant.id)
                const status = t(collectionStatusKey(stage))
                return (
                  <li
                    aria-label={t('collection.plantStatus', {
                      plant: name,
                      status,
                    })}
                    className={`collection-plant collection-plant--${stage}`}
                    key={plant.id}
                  >
                    <CollectionPlantPortrait plant={plant} />
                    <strong>{stage === 'locked' ? t('collection.unknownPlant') : name}</strong>
                    <span>{status}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}

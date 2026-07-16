import { LearningEngine } from '@little-tables/domain'
import { Link } from '@tanstack/react-router'

import { GardenPlot } from '../components/garden-plot.js'
import { dailyGardenMoment } from '../daily-garden-moment.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { usePracticeLauncher } from '../hooks/use-practice-launcher.js'
import { translatePlantName, useI18n } from '../i18n.js'

export function GardenScreen() {
  const { locale, t } = useI18n()
  const bootstrap = useLocalBootstrap()
  const data = bootstrap.data
  const launcher = usePracticeLauncher(data)
  const previewValue = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('blooms')
    : null
  const previewNumber = previewValue === null ? Number.NaN : Number(previewValue)
  const progress = LearningEngine.deriveGardenProgress({
    completedSessions: Number.isFinite(previewNumber)
      ? previewNumber
      : (data?.gardenBloomCount ?? data?.completedSessions ?? 0),
    snapshot: data?.snapshot ?? LearningEngine.emptySnapshot(),
  })
  const bloomCount = progress.bloomCount
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const dayKey = LearningEngine.learningDayKey({ at: new Date(), timeZone })
  const ambientMoment = dailyGardenMoment({ bloomCount, dayKey })
  const nextStep = progress.nextStep
  const nextPlant = nextStep === null ? '' : translatePlantName(locale, nextStep.plant.id)
  const nextTitle =
    nextStep === null
      ? t('garden.nextFull')
      : nextStep.unlocksPot
        ? t('garden.nextUnlock')
        : nextStep.targetStage === 'mature'
          ? t('garden.nextBloom', { plant: nextPlant })
          : t('garden.nextGrow', { plant: nextPlant })
  const bloomWord = t(nextStep?.bloomsRemaining === 1 ? 'common.bloom' : 'common.blooms')
  const masteryCopy =
    nextStep === null || nextStep.fluentFactsRemaining === 0
      ? ''
      : t(nextStep.fluentFactsRemaining === 1 ? 'chapter.oneToGo' : 'chapter.manyToGo', {
          count: nextStep.fluentFactsRemaining,
        })
  const nextCopy =
    nextStep === null
      ? t('garden.allBlooming')
      : nextStep.blockedByMastery
        ? masteryCopy
        : nextStep.unlocksPot
          ? t('garden.nextUnlockCopy', {
              bloom: bloomWord,
              count: nextStep.bloomsRemaining,
              plant: nextPlant,
            })
          : nextStep.targetStage === 'mature'
            ? t('garden.nextFinishes', {
                bloom: bloomWord,
                count: nextStep.bloomsRemaining,
              })
            : t('garden.nextStarts', {
                bloom: bloomWord,
                count: nextStep.bloomsRemaining,
              })
  const activeSession = data?.activeSession ?? null
  const dailyWateringDone = data?.rewardedDayKeys.includes(dayKey) === true
  const actionTitle =
    activeSession === null
      ? dailyWateringDone
        ? t('watering.extra')
        : nextTitle
      : t(activeSession.kind === 'daily-watering' ? 'watering.resume' : 'home.resume')
  const actionCopy =
    activeSession === null
      ? dailyWateringDone
        ? t('garden.extraCopy')
        : nextCopy
      : t('garden.resumeCopy')
  const actionAdvancesGarden = activeSession === null && !dailyWateringDone

  const practice = async () => {
    if (data?.activeSession !== null && data?.activeSession !== undefined) {
      await launcher.resume()
      return
    }
    if (dailyWateringDone) {
      await launcher.startQuick()
      return
    }
    await launcher.startDaily()
  }

  return (
    <section className="garden-screen">
      <header className="garden-heading">
        <h1>{t('garden.heading')}</h1>
        <p className="garden-bloom-count">
          {t('garden.bloomCount', {
            bloom: t(bloomCount === 1 ? 'common.bloom' : 'common.blooms'),
            count: bloomCount,
          })}
        </p>
        <p className="garden-ambient-moment">
          <span aria-hidden="true">✦</span>
          {t(`ambient.${ambientMoment}`)}
        </p>
        <Link className="garden-collection-link" to="/garden/collection">
          <span aria-hidden="true">▤</span>
          {t('collection.open')}
        </Link>
      </header>
      <div className="garden-ground-region">
        <GardenPlot progress={progress} />
        <button
          aria-label={t('garden.ariaPractice', { title: actionTitle })}
          className="tomorrow-card"
          disabled={bootstrap.isLoading}
          onClick={() => void practice()}
          type="button"
        >
          <span aria-hidden="true" className="next-pot-icon">
            ♧
          </span>
          <div>
            <strong>{actionTitle}</strong>
            <p>{actionCopy}</p>
            {nextStep !== null &&
            nextStep.fluentFactsRemaining > 0 &&
            !nextStep.blockedByMastery &&
            actionAdvancesGarden ? (
              <small className="garden-mastery-milestone">{masteryCopy}</small>
            ) : null}
          </div>
          <span aria-hidden="true" className="tomorrow-chevron">
            ›
          </span>
        </button>
      </div>
    </section>
  )
}

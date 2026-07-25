import { LearningEngine } from '@little-tables/domain'
import { Link } from '@tanstack/react-router'

import { GardenPlot } from '../components/garden-plot.js'
import { dailyGardenMoment } from '../daily-garden-moment.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { usePracticeLauncher } from '../hooks/use-practice-launcher.js'
import { translatePlantName, useI18n } from '../i18n.js'

function GardenBookIcon() {
  return (
    <svg aria-hidden="true" className="garden-book-symbol" viewBox="0 0 28 28">
      <path d="M4.8 6.6c3.3-.7 6.5-.1 9.2 1.8v14c-2.7-1.9-5.9-2.5-9.2-1.8v-14Z" />
      <path d="M23.2 6.6c-3.3-.7-6.5-.1-9.2 1.8v14c2.7-1.9 5.9-2.5 9.2-1.8v-14Z" />
      <path className="garden-book-symbol__spine" d="M14 8.4v14" />
      <path className="garden-book-symbol__bookmark" d="M18.9 7.2v7l1.4-1 1.4 1V6.8" />
      <path className="garden-book-symbol__stem" d="M9.2 17.6v-4.1" />
      <path
        className="garden-book-symbol__leaves"
        d="M9.2 15.2c-1.5 0-2.3-.7-2.3-2 1.5 0 2.3.7 2.3 2ZM9.2 14.2c0-1.3.8-2 2.2-2-.1 1.3-.8 2-2.2 2Z"
      />
      <circle className="garden-book-symbol__flower" cx="9.2" cy="11.3" r="1.35" />
    </svg>
  )
}

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
    flowerOrder: data?.gardenCollection.flowerOrder,
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
      : nextStep.blockedByMastery
        ? t('garden.masteryBlocked', {
            remaining: nextStep.fluentFactsRemaining,
          })
        : t('garden.masteryAhead', {
            remaining: nextStep.fluentFactsRemaining,
            required: nextStep.plant.masteryRequired,
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
          <GardenBookIcon />
          {t('collection.open')}
        </Link>
      </header>
      <div className="garden-ground-region">
        {nextStep === null ? null : (
          <aside className="garden-next-goal">
            <span>{t('garden.nextGoal')}</span>
            <strong>{translatePlantName(locale, nextStep.plant.id)}</strong>
            <p>
              {t('garden.goalProgress', {
                current: nextStep.plant.bloomsEarned,
                total: nextStep.plant.bloomsRequired,
              })}
            </p>
            <small>
              {nextStep.blockedByMastery
                ? masteryCopy
                : t(
                    nextStep.plant.bloomsRequired - nextStep.plant.bloomsEarned === 1
                      ? 'garden.goalRemainingOne'
                      : 'garden.goalRemaining',
                    {
                      count: nextStep.plant.bloomsRequired - nextStep.plant.bloomsEarned,
                    },
                  )}
            </small>
          </aside>
        )}
        <GardenPlot progress={progress} />
        <details className="garden-how-it-grows">
          <summary>{t('garden.howHeading')}</summary>
          <ul>
            <li>{t('garden.howDaily')}</li>
            <li>{t('garden.howExtra')}</li>
            <li>{t('garden.howCollection')}</li>
            <li>{t('garden.howMastery')}</li>
            <li>{t('garden.howRest')}</li>
          </ul>
        </details>
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

import { LearningEngine } from '@little-tables/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { GardenPlot } from '../components/garden-plot.js'
import { useFlowerTransition } from '../flower-transition.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { launchPracticeSession, resumePracticeSession } from '../practice-session-launch.js'
import { localBootstrapQueryKey, practiceStore } from '../store.js'
import { translatePlantName, useI18n } from '../i18n.js'

export function GardenScreen() {
  const { locale, t } = useI18n()
  const bootstrap = useLocalBootstrap()
  const navigate = useNavigate()
  const transition = useFlowerTransition()
  const queryClient = useQueryClient()
  const data = bootstrap.data
  const previewValue = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('blooms')
    : null
  const previewNumber = previewValue === null ? Number.NaN : Number(previewValue)
  const progress = LearningEngine.deriveGardenProgress({
    completedSessions: Number.isFinite(previewNumber)
      ? previewNumber
      : (data?.completedSessions ?? 0),
    snapshot: data?.snapshot ?? LearningEngine.emptySnapshot(),
  })
  const bloomCount = progress.bloomCount
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
  const nextCopy =
    nextStep === null
      ? t('garden.allBlooming')
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

  const practice = async () => {
    if (data?.activeSession !== null && data?.activeSession !== undefined) {
      await resumePracticeSession({
        navigate: () => navigate({ to: '/practice' }),
        transition,
      })
      return
    }

    const snapshot = data?.snapshot ?? LearningEngine.emptySnapshot()
    const firstVisit = snapshot.processedEventIds.length === 0
    const session = LearningEngine.createSession({
      now: new Date(),
      policy: { questionCount: firstVisit ? 8 : 10 },
      seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now(),
      snapshot,
    })
    await launchPracticeSession({
      invalidate: () => queryClient.invalidateQueries({ queryKey: localBootstrapQueryKey }),
      navigate: () => navigate({ to: '/practice' }),
      persist: () => practiceStore.startSession(session, snapshot),
      transition,
    })
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
      </header>
      <div className="garden-ground-region">
        <GardenPlot progress={progress} />
        <button
          aria-label={t('garden.ariaPractice', { title: nextTitle })}
          className="tomorrow-card"
          disabled={bootstrap.isLoading}
          onClick={() => void practice()}
          type="button"
        >
          <span aria-hidden="true" className="next-pot-icon">
            ♧
          </span>
          <div>
            <strong>{nextTitle}</strong>
            <p>{nextCopy}</p>
          </div>
          <span aria-hidden="true" className="tomorrow-chevron">
            ›
          </span>
        </button>
      </div>
    </section>
  )
}

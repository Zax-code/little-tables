import { LearningEngine } from '@little-tables/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { GardenPlot } from '../components/garden-plot.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { localBootstrapQueryKey, practiceStore } from '../store.js'

export function GardenScreen() {
  const bootstrap = useLocalBootstrap()
  const navigate = useNavigate()
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
  const nextTitle =
    nextStep === null
      ? 'garden in full bloom'
      : nextStep.unlocksPot
        ? 'next: unlock a new pot'
        : nextStep.targetStage === 'mature'
          ? `next: bloom ${nextStep.plant.name}`
          : `next: grow ${nextStep.plant.name}`
  const bloomWord = nextStep?.bloomsRemaining === 1 ? 'bloom' : 'blooms'
  const nextCopy =
    nextStep === null
      ? 'every little plant is blooming'
      : nextStep.unlocksPot
        ? `${nextStep.bloomsRemaining} more ${bloomWord} opens the ${nextStep.plant.name} pot`
        : nextStep.targetStage === 'mature'
          ? `${nextStep.bloomsRemaining} more ${bloomWord} finishes this flower`
          : `${nextStep.bloomsRemaining} more ${bloomWord} starts this bud`

  const practice = async () => {
    if (data?.activeSession !== null && data?.activeSession !== undefined) {
      await navigate({ to: '/practice' })
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
    await practiceStore.startSession(session, snapshot)
    await queryClient.invalidateQueries({ queryKey: localBootstrapQueryKey })
    await navigate({ to: '/practice' })
  }

  return (
    <section className="garden-screen">
      <header className="garden-heading">
        <h1>your little garden</h1>
        <p className="garden-bloom-count">
          {bloomCount} {bloomCount === 1 ? 'bloom' : 'blooms'}
        </p>
      </header>
      <div className="garden-ground-region">
        <GardenPlot progress={progress} />
        <button
          aria-label={`${nextTitle}. Practice now`}
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

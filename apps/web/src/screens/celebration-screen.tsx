import { LearningEngine } from '@little-tables/domain'
import { useNavigate } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

import { Bunny } from '../components/bunny.js'
import { gardenPlantVisuals } from '../components/garden-plant-catalog.js'
import { GardenRewardFlower } from '../components/garden-plant-renderers.js'
import { Screen } from '../components/screen.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'

export function CelebrationScreen() {
  const bootstrap = useLocalBootstrap()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion() === true
  const data = bootstrap.data
  const completion = data?.lastCompletion ?? null
  useEffect(() => {
    if (data !== undefined && completion === null) void navigate({ to: '/' })
  }, [completion, data, navigate])

  if (data === undefined || completion === null) {
    return (
      <Screen footer={false}>
        <div className="loading-state">gathering your tiny win…</div>
      </Screen>
    )
  }

  const progress = LearningEngine.deriveGardenProgress({
    completedSessions: completion.bloomNumber,
    snapshot: data.snapshot,
  })
  const featuredPlant = progress.featuredPlant
  const bloomName = featuredPlant?.name ?? 'bloom'
  const bloomKind = featuredPlant === null ? 'tulip' : gardenPlantVisuals[featuredPlant.id].kind
  const perfectSession = completion.correctAnswers === completion.totalAnswers
  const heading = completion.finalCorrect ? `yes! ${completion.finalAnswer} ♡` : 'you did it ♡'

  return (
    <Screen footer={false}>
      <section className="celebration-screen">
        <div className="confetti" aria-hidden="true">
          <i>●</i>
          <i>✿</i>
          <i>♡</i>
          <i>●</i>
        </div>
        <header className="celebration-copy">
          <h1>{heading}</h1>
          <p>{perfectSession ? 'perfect little streak' : 'tiny win complete'}</p>
        </header>
        <Bunny className="celebration-bunny" scene="celebration" />
        <motion.div
          className="reward-chip"
          initial={reduceMotion ? false : { scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={
            reduceMotion ? { duration: 0 } : { delay: 0.22, type: 'spring', stiffness: 280 }
          }
        >
          <GardenRewardFlower kind={bloomKind} /> +1 {bloomName}
        </motion.div>
        <div className="celebration-actions">
          <button className="primary-button" onClick={() => void navigate({ to: '/garden' })}>
            next
          </button>
        </div>
      </section>
    </Screen>
  )
}

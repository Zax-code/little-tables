import { LearningEngine } from '@little-tables/domain'
import { useNavigate } from '@tanstack/react-router'
import { m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

import { CelebrationSprite } from '../components/celebration-sprite.js'
import { CorrectAnswerConfetti } from '../components/correct-answer-confetti.js'
import { gardenPlantVisuals } from '../components/garden-plant-catalog.js'
import { GardenRewardFlower } from '../components/garden-plant-renderers.js'
import { Screen } from '../components/screen.js'
import { useFlowerTransition } from '../flower-transition.js'
import { useLocalBootstrap } from '../hooks/use-local-bootstrap.js'
import { returnToGardenAfterPractice } from '../practice-session-launch.js'
import { celebrationExtraPracticeCopy, celebrationRewardCopy } from './celebration-reward-copy.js'
import { sessionInsightCopy } from './session-insight-copy.js'
import { formatAnswer, formatNumber } from '../exercise-format.js'
import { useI18n } from '../i18n.js'

export function CelebrationScreen() {
  const { locale, t } = useI18n()
  const bootstrap = useLocalBootstrap()
  const navigate = useNavigate()
  const transition = useFlowerTransition()
  const reduceMotion = useReducedMotion() === true
  const data = bootstrap.data
  const completion = data?.lastCompletion ?? null
  useEffect(() => {
    if (data !== undefined && completion === null) void navigate({ to: '/' })
  }, [completion, data, navigate])

  if (data === undefined || completion === null) {
    return (
      <Screen footer={false}>
        <div className="loading-state">{t('celebration.gathering')}</div>
      </Screen>
    )
  }

  const progress = LearningEngine.deriveGardenProgress({
    awardedFlowerIds: data.gardenCollection.awardedFlowerIds,
    completedSessions: completion.bloomNumber,
    flowerOrder: data.gardenCollection.flowerOrder,
    snapshot: data.snapshot,
  })
  const featuredPlant = progress.featuredPlant
  const bloomVisual =
    featuredPlant === null ? gardenPlantVisuals['rose-lotus'] : gardenPlantVisuals[featuredPlant.id]
  const rewardCopy = celebrationRewardCopy(progress, locale)
  const insightCopy =
    completion.learningInsight === null
      ? t('insight.persisted')
      : sessionInsightCopy(completion.learningInsight, locale)
  const perfectSession = completion.correctAnswers === completion.totalAnswers
  const finalAnswer =
    completion.finalExpected === undefined
      ? formatNumber(completion.finalAnswer, locale)
      : completion.finalExpected.type === 'integer' || completion.finalExpected.type === 'fraction'
        ? formatAnswer(completion.finalExpected, locale)
        : null
  const heading =
    completion.finalCorrect && finalAnswer !== null
      ? t('celebration.headingAnswer', { answer: finalAnswer })
      : t('celebration.heading')

  return (
    <Screen footer={false}>
      <section className="celebration-screen">
        {reduceMotion ? null : <CorrectAnswerConfetti variant="flowers" />}
        <div className="confetti" aria-hidden="true">
          <i>✿</i>
          <i>❀</i>
          <i>✾</i>
          <i>❁</i>
        </div>
        <div className="celebration-details">
          <header className="celebration-copy">
            <h1>{heading}</h1>
            <p>{perfectSession ? t('celebration.perfect') : t('celebration.complete')}</p>
          </header>
          <div className="learning-summary">
            <strong>
              {completion.sessionKind === 'daily-watering'
                ? t('insight.dailyCare')
                : t('celebration.complete')}
            </strong>
            <p>{insightCopy}</p>
          </div>
          {completion.gardenBloomEarned ? (
            <div className="reward-summary">
              <m.div
                className="reward-chip"
                initial={reduceMotion ? false : { scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={
                  reduceMotion ? { duration: 0 } : { delay: 0.22, type: 'spring', stiffness: 280 }
                }
              >
                <GardenRewardFlower
                  accentColor={bloomVisual.accentColor}
                  centerColor={bloomVisual.centerColor}
                  kind={bloomVisual.kind}
                  petalColor={bloomVisual.petalColor}
                />{' '}
                {t('celebration.gardenBloom')}
              </m.div>
              <p className="reward-explanation">{rewardCopy}</p>
            </div>
          ) : completion.sessionKind === 'extra-practice' ? (
            <div className="reward-summary reward-summary--extra-practice">
              <strong>{t('celebration.complete')}</strong>
              <p className="reward-explanation">{celebrationExtraPracticeCopy(locale)}</p>
            </div>
          ) : null}
          <div className="celebration-actions">
            <button
              className="primary-button"
              onClick={() =>
                void returnToGardenAfterPractice({
                  navigate: () => navigate({ to: '/garden' }),
                  transition,
                })
              }
              type="button"
            >
              {t('celebration.next')}
            </button>
          </div>
        </div>
        <CelebrationSprite />
      </section>
    </Screen>
  )
}

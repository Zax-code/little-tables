import { LearningEngine } from '@little-tables/domain'
import { describe, expect, it } from 'vitest'

import { celebrationRewardCopy } from './celebration-reward-copy.js'

describe('celebration reward copy', () => {
  it('explains how the earned bloom advances a growing flower', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 5,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe(
      'Tulipe rouge grandit joliment — encore 2 fleurs avant l’éclosion.',
    )
    expect(celebrationRewardCopy(progress, 'en')).toBe(
      'Red tulip is growing—2 more blooms to finish it.',
    )
  })

  it('celebrates when the earned bloom finishes a flower', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 2,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe('Tulipe corail vient d’éclore pour de bon.')
  })

  it('explains that the garden is complete after the final milestone', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 15,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe('Tout le petit jardin est en fleurs.')
  })
})

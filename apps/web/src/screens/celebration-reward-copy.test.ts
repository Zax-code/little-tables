import { LearningEngine } from '@little-tables/domain'
import { describe, expect, it } from 'vitest'

import { celebrationRewardCopy } from './celebration-reward-copy.js'

describe('celebration reward copy', () => {
  it('explains how the earned bloom advances a growing flower', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 1,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe(
      'Lotus rosé grandit joliment — encore 4 fleurs avant l’éclosion.',
    )
    expect(celebrationRewardCopy(progress, 'en')).toBe(
      'Rose lotus is growing—4 more blooms to finish it.',
    )
  })

  it('celebrates when the earned bloom finishes a flower', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 5,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe('Lotus rosé vient d’éclore pour de bon.')
  })

  it('explains a mastery-gated showcase plant without claiming the garden is complete', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 15,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe('encore 5 calculs bien ancrés pour ouvrir ce coin')
  })
})

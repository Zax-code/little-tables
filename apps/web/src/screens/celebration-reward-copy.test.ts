import { LearningEngine } from '@little-tables/domain'
import { describe, expect, it } from 'vitest'

import { celebrationExtraPracticeCopy, celebrationRewardCopy } from './celebration-reward-copy.js'

describe('celebration reward copy', () => {
  it('explains how the earned bloom advances a growing flower', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 1,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe(
      'Lotus rosé : progression 1 sur 3 fleurs du jour — encore 2 avant de rejoindre ta collection.',
    )
    expect(celebrationRewardCopy(progress, 'en')).toBe(
      'Rose lotus: 1 of 3 daily blooms. 2 more to join your collection.',
    )
  })

  it('celebrates when the earned bloom finishes a flower', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 3,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe(
      'Lotus rosé vient d’éclore et rejoint ta collection pour de bon. Prochaine découverte : Lupin du crépuscule.',
    )
  })

  it('celebrates the final flower joining the collection', () => {
    const progress = LearningEngine.deriveGardenProgress({
      awardedFlowerIds: LearningEngine.gardenFlowerIds,
      completedSessions: 27,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress, 'en')).toBe(
      'Blue wisteria is fully grown and has joined your collection. Your whole garden is blooming.',
    )
  })

  it('explains a mastery-gated showcase plant without claiming the garden is complete', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 9,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe(
      'Cette plante a déjà ses 3 fleurs. Réussis encore 5 multiplications sans aide pour la débloquer. Ses fleurs restent bien au chaud.',
    )
  })

  it('celebrates extra-practice learning and says the next bloom is tomorrow', () => {
    expect(celebrationExtraPracticeCopy('en')).toBe(
      'Your math skills got stronger. The garden grows once per day, so there is no extra bloom today—the next bloom is ready tomorrow.',
    )
    expect(celebrationExtraPracticeCopy()).toContain('Le jardin pousse une fois par jour')
    expect(celebrationExtraPracticeCopy()).toContain('la prochaine t’attend demain')
  })
})

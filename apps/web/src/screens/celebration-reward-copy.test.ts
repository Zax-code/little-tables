import { LearningEngine } from '@little-tables/domain'
import { describe, expect, it } from 'vitest'

import { celebrationExtraPracticeCopy, celebrationRewardCopy } from './celebration-reward-copy.js'

describe('celebration reward copy', () => {
  it('explains how the earned watering advances a growing plant', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 1,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(celebrationRewardCopy(progress)).toBe(
      'Arrosages pour Lotus rosé : 1 sur 3. Encore 2 pour remplir son objectif de croissance.',
    )
    expect(celebrationRewardCopy(progress, 'en')).toBe(
      'Watering progress for Rose lotus: 1 of 3. 2 more to fill its growth goal.',
    )
    expect(celebrationRewardCopy(progress, 'zh-Hans')).toBe(
      '玫瑰粉荷花的浇水进度是 1/3。再浇 2 次水，就能达到生长目标。',
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
    expect(celebrationRewardCopy(progress, 'zh-Hans')).toBe(
      '玫瑰粉荷花已经长成，收进你的花园图鉴啦。下一株等你发现的是暮色羽扇豆。',
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
      'Les 3 arrosages de cette plante sont faits. Réussis encore 5 calculs sans aide pour l’aider à éclore. Ses progrès sont bien gardés.',
    )
    expect(celebrationRewardCopy(progress, 'zh-Hans')).toBe(
      '已经浇满 3 次水啦。再不看提示，自己答对 5 道题，它就会开花。浇水进度会好好保留。',
    )
  })

  it.each([
    [7, 1, 2],
    [8, 2, 1],
  ])(
    'reports bloom and mastery progress together before the gate at bloom %i',
    (completedSessions, current, remainingBlooms) => {
      const progress = LearningEngine.deriveGardenProgress({
        completedSessions,
        snapshot: LearningEngine.emptySnapshot(),
      })

      expect(celebrationRewardCopy(progress, 'en')).toBe(
        `Watering progress for Velvet foxglove: ${current} of 3, with ${remainingBlooms} more to fill its growth goal. It also needs 5 facts answered without hints; 5 to go.`,
      )
      expect(celebrationRewardCopy(progress, 'en')).not.toContain('3 flowers')
    },
  )

  it('celebrates extra-practice learning and says the next watering is tomorrow', () => {
    expect(celebrationExtraPracticeCopy('en')).toBe(
      'Your math skills got stronger. Today’s watering is safe in the garden, and the next watering is ready tomorrow.',
    )
    expect(celebrationExtraPracticeCopy()).toContain('L’arrosage d’aujourd’hui est bien gardé')
    expect(celebrationExtraPracticeCopy()).toContain('le prochain t’attend demain')
    expect(celebrationExtraPracticeCopy('zh-Hans')).toBe(
      '你的乘法又熟练了一点。今天的水已经浇好，明天可以再浇一次。',
    )
  })
})

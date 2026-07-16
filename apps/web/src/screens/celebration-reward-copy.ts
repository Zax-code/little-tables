import type { GardenProgress } from '@little-tables/domain'

import { translate, translatePlantName, type Locale } from '../i18n.js'

function sentenceCase(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}

export function celebrationRewardCopy(progress: GardenProgress, locale: Locale = 'fr'): string {
  if (progress.nextStep === null) return translate(locale, 'celebration.rewardAllBlooming')

  const plant = progress.featuredPlant
  if (plant === null) {
    const remaining = progress.nextStep.fluentFactsRemaining
    return remaining > 0
      ? translate(locale, remaining === 1 ? 'chapter.oneToGo' : 'chapter.manyToGo', {
          count: remaining,
        })
      : translate(locale, 'celebration.rewardAllBlooming')
  }

  const plantName = sentenceCase(translatePlantName(locale, plant.id))
  if (plant.stage === 'mature') {
    return translate(locale, 'celebration.rewardMature', { plant: plantName })
  }

  const remaining = progress.nextStep.bloomsRemaining
  return translate(locale, 'celebration.rewardGrowing', {
    bloom: translate(locale, remaining === 1 ? 'common.bloom' : 'common.blooms'),
    count: remaining,
    plant: plantName,
  })
}

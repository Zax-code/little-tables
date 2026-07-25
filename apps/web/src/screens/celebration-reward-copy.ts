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
      ? translate(locale, 'garden.masteryBlocked', {
          remaining,
        })
      : translate(locale, 'celebration.rewardAllBlooming')
  }

  const plantName = sentenceCase(translatePlantName(locale, plant.id))
  if (plant.stage === 'mature') {
    return translate(locale, 'celebration.rewardMature', { plant: plantName })
  }

  return translate(locale, 'celebration.rewardGrowing', {
    current: plant.bloomsEarned,
    plant: plantName,
    remaining: plant.bloomsRequired - plant.bloomsEarned,
    total: plant.bloomsRequired,
  })
}

export const celebrationExtraPracticeCopy = (locale: Locale = 'fr'): string =>
  translate(locale, 'celebration.noExtraBloom')

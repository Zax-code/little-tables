import type { GardenProgress } from '@little-tables/domain'

import { translate, translatePlantName, type Locale } from '../i18n.js'

function sentenceCase(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}

export function celebrationRewardCopy(progress: GardenProgress, locale: Locale = 'fr'): string {
  const plant = progress.featuredPlant
  if (plant?.stage === 'mature') {
    const plantName = sentenceCase(translatePlantName(locale, plant.id))
    return progress.nextStep === null
      ? translate(locale, 'celebration.rewardMatureFinal', { plant: plantName })
      : translate(locale, 'celebration.rewardMature', {
          nextPlant: sentenceCase(translatePlantName(locale, progress.nextStep.plant.id)),
          plant: plantName,
        })
  }
  if (progress.nextStep === null) return translate(locale, 'celebration.rewardAllBlooming')

  if (plant === null) {
    const nextStep = progress.nextStep
    if (nextStep.fluentFactsRemaining === 0) {
      return translate(locale, 'celebration.rewardAllBlooming')
    }
    if (nextStep.blockedByMastery) {
      return translate(locale, 'garden.masteryBlocked', {
        remaining: nextStep.fluentFactsRemaining,
      })
    }
    return translate(locale, 'celebration.rewardGrowingMastery', {
      current: nextStep.plant.bloomsEarned,
      plant: sentenceCase(translatePlantName(locale, nextStep.plant.id)),
      remainingBlooms: nextStep.plant.bloomsRequired - nextStep.plant.bloomsEarned,
      remainingFacts: nextStep.fluentFactsRemaining,
      required: nextStep.plant.masteryRequired,
      total: nextStep.plant.bloomsRequired,
    })
  }

  const plantName = sentenceCase(translatePlantName(locale, plant.id))
  return translate(locale, 'celebration.rewardGrowing', {
    current: plant.bloomsEarned,
    plant: plantName,
    remaining: plant.bloomsRequired - plant.bloomsEarned,
    total: plant.bloomsRequired,
  })
}

export const celebrationExtraPracticeCopy = (locale: Locale = 'fr'): string =>
  translate(locale, 'celebration.noExtraBloom')

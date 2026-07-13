import type { GardenProgress } from '@little-tables/domain'

function sentenceCase(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}

export function celebrationRewardCopy(progress: GardenProgress): string {
  if (progress.nextStep === null) return 'Every little plant is blooming.'

  const plant = progress.featuredPlant
  if (plant === null) return 'Every little plant is blooming.'

  const plantName = sentenceCase(plant.name)
  if (plant.stage === 'mature') return `${plantName} is now fully grown.`

  const remaining = progress.nextStep.bloomsRemaining
  const bloomWord = remaining === 1 ? 'bloom' : 'blooms'
  return `${plantName} is growing—${remaining} more ${bloomWord} to finish it.`
}

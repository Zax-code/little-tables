type RandomSource = () => number

type GardenTarget = Readonly<{
  id: string
}>

export const gardenWateringCycleMs = 3_000

export function gardenWorldX(pageIndex: number, pageWidth: number, localX: number) {
  return pageIndex * pageWidth + localX
}

export function pickNextGardenTarget<Target extends GardenTarget>(
  currentTargetId: string,
  targets: readonly Target[],
  random: RandomSource = Math.random,
): Target | undefined {
  if (targets.length === 0) return undefined
  if (targets.length === 1) return targets[0]

  const currentIndex = targets.findIndex(({ id }) => id === currentTargetId)
  if (currentIndex < 0) {
    const randomValue = Math.min(Math.max(random(), 0), 1 - Number.EPSILON)
    return targets[Math.floor(randomValue * targets.length)]
  }

  const randomValue = Math.min(Math.max(random(), 0), 1 - Number.EPSILON)
  const offset = 1 + Math.floor(randomValue * (targets.length - 1))

  return targets[(currentIndex + offset) % targets.length]
}

export function selectGardenCaretakerTarget<Target extends GardenTarget>(
  currentTargetId: string | undefined,
  targets: readonly Target[],
  random: RandomSource = Math.random,
  initialTargets: readonly Target[] = targets,
): Target | undefined {
  const currentTarget = targets.find(({ id }) => id === currentTargetId)
  if (currentTarget !== undefined) return currentTarget
  return pickNextGardenTarget('', currentTargetId === undefined ? initialTargets : targets, random)
}

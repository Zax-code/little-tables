type RandomSource = () => number

type GardenTarget = Readonly<{
  id: string
}>

type GardenPageTarget = GardenTarget &
  Readonly<{
    pageIndex: number
  }>

type GardenJourneyTarget = GardenTarget &
  Readonly<{
    caretakerX: number
    pageIndex: number
  }>

type GardenJourneyBounds = Readonly<{
  canvasWidth: number
  caretakerWidth: number
}>

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

export function gardenTargetsForPage<Target extends GardenPageTarget>(
  pageIndex: number,
  targets: readonly Target[],
): readonly Target[] {
  return targets.filter((target) => target.pageIndex === pageIndex)
}

export function pickNextGardenTargetInGarden<Target extends GardenPageTarget>(
  currentTarget: Target,
  targets: readonly Target[],
  random: RandomSource = Math.random,
): Target | undefined {
  const gardenTargets = gardenTargetsForPage(currentTarget.pageIndex, targets)
  if (gardenTargets.length < 2) return undefined
  return pickNextGardenTarget(currentTarget.id, gardenTargets, random)
}

export function selectGardenCaretakerTarget<Target extends GardenTarget>(
  currentTargetId: string | undefined,
  targets: readonly Target[],
  random: RandomSource = Math.random,
): Target | undefined {
  return (
    targets.find(({ id }) => id === currentTargetId) ?? pickNextGardenTarget('', targets, random)
  )
}

export function planGardenJourney<Target extends GardenJourneyTarget>(
  source: Target,
  destination: Target,
  { canvasWidth, caretakerWidth }: GardenJourneyBounds,
) {
  if (source.pageIndex === destination.pageIndex) {
    return { destination, kind: 'within-garden' as const }
  }

  const direction =
    destination.pageIndex > source.pageIndex ? ('right' as const) : ('left' as const)
  return {
    arrival: {
      ...destination,
      caretakerX: direction === 'right' ? -caretakerWidth : canvasWidth,
    },
    departure: {
      ...source,
      caretakerX: direction === 'right' ? canvasWidth : -caretakerWidth,
    },
    destination,
    direction,
    kind: 'between-gardens' as const,
  }
}

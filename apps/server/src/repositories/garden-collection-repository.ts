import { LearningEngine, type GardenPlantId } from '@little-tables/domain'
import { Context, Data, type Effect } from 'effect'

export const gardenCollectionCatalogVersion = '1' as const

export type GardenCollectionRecord = Readonly<{
  awardedFlowerIds: ReadonlyArray<GardenPlantId>
  bloomCount: number
  bloomsPerFlower: typeof LearningEngine.gardenBloomsPerFlower
  catalogVersion: typeof gardenCollectionCatalogVersion
  createdAt: Date
  flowerOrder: ReadonlyArray<GardenPlantId>
  introductionSeen: boolean
  profileId: string
  rewardedDayKeys: ReadonlyArray<string>
  updatedAt: Date
}>

export type GardenCollectionReconciliation = Readonly<{
  awardedFlowerIds: ReadonlyArray<GardenPlantId>
  bloomCount: number
  rewardedDayKeys: ReadonlyArray<string>
}>

export type LoadGardenCollectionInput = Readonly<{
  preferredFlowerPrefix: ReadonlyArray<GardenPlantId>
  profileId: string
}>

export class GardenCollectionRepositoryError extends Data.TaggedError(
  'GardenCollectionRepositoryError',
)<{
  cause: unknown
  operation: 'health' | 'load-or-create' | 'mark-introduction-seen' | 'reconcile'
}> {}

export type GardenCollectionRepositoryService = Readonly<{
  health: Effect.Effect<void, GardenCollectionRepositoryError>
  loadOrCreate: (
    input: LoadGardenCollectionInput,
  ) => Effect.Effect<GardenCollectionRecord, GardenCollectionRepositoryError>
  markIntroductionSeen: (
    profileId: string,
  ) => Effect.Effect<GardenCollectionRecord, GardenCollectionRepositoryError>
  reconcile: (
    profileId: string,
    reconciliation: GardenCollectionReconciliation,
  ) => Effect.Effect<GardenCollectionRecord, GardenCollectionRepositoryError>
}>

export class GardenCollectionRepository extends Context.Tag(
  '@little-tables/GardenCollectionRepository',
)<GardenCollectionRepository, GardenCollectionRepositoryService>() {}

export const personalizedFlowerOrder = (
  preferredFlowerPrefix: ReadonlyArray<GardenPlantId>,
  randomIndex: (upperBound: number) => number,
): ReadonlyArray<GardenPlantId> => {
  const knownIds = new Set<GardenPlantId>(LearningEngine.gardenFlowerIds)
  const prefix = preferredFlowerPrefix.filter(
    (id, index) => knownIds.has(id) && preferredFlowerPrefix.indexOf(id) === index,
  )
  const remaining = LearningEngine.gardenFlowerIds.filter((id) => !prefix.includes(id))
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1)
    const current = remaining[index]
    const replacement = remaining[swapIndex]
    if (current === undefined || replacement === undefined) continue
    remaining[index] = replacement
    remaining[swapIndex] = current
  }
  return [...prefix, ...remaining]
}

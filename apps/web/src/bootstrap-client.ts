import {
  LearningEngine,
  type GardenCollectionSnapshot,
  type GardenPlantId,
  type LearningSnapshot,
} from '@little-tables/domain'
import { Schema } from 'effect'

const FactMasterySchema = Schema.Struct({
  correctCount: Schema.NonNegativeInt,
  correctStreak: Schema.NonNegativeInt,
  difficulty: Schema.Number,
  dueAt: Schema.NullOr(Schema.DateFromString),
  lapseCount: Schema.NonNegativeInt,
  lastReviewedAt: Schema.NullOr(Schema.DateFromString),
  lastReviewedDayKey: Schema.optional(Schema.NonEmptyString),
  latencyMs: Schema.NullOr(Schema.NonNegativeInt),
  recallDayKeys: Schema.Array(Schema.NonEmptyString),
  stabilityDays: Schema.NonNegative,
  state: Schema.Literal('unseen', 'learning', 'familiar', 'fluent'),
  successfulDayKeys: Schema.Array(Schema.NonEmptyString),
})

const LearningSnapshotSchema = Schema.Struct({
  algorithmVersion: Schema.Literal('1'),
  facts: Schema.Record({ key: Schema.String, value: FactMasterySchema }),
  processedEventIds: Schema.Array(Schema.NonEmptyString),
})

const GardenPlantIdSchema = Schema.Literal(...LearningEngine.gardenFlowerIds)
const GardenCollectionSnapshotSchema = Schema.Struct({
  awardedFlowerIds: Schema.Array(GardenPlantIdSchema),
  bloomsPerFlower: Schema.Literal(LearningEngine.gardenBloomsPerFlower),
  catalogVersion: Schema.Literal('1'),
  flowerOrder: Schema.Array(GardenPlantIdSchema).pipe(
    Schema.filter(
      (order) =>
        order.length === LearningEngine.gardenFlowerIds.length &&
        new Set(order).size === LearningEngine.gardenFlowerIds.length &&
        LearningEngine.gardenFlowerIds.every((id) => order.includes(id)),
      { message: () => 'Garden flower order must contain every flower exactly once' },
    ),
  ),
  introductionSeen: Schema.Boolean,
})

const ServerBootstrapSchema = Schema.Struct({
  completedSessions: Schema.optional(Schema.NonNegativeInt),
  gardenBloomCount: Schema.optional(Schema.NonNegativeInt),
  gardenCollection: Schema.optional(GardenCollectionSnapshotSchema),
  practiceDayKeys: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  rewardedDayKeys: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  snapshot: LearningSnapshotSchema,
})

export type ServerBootstrap = Readonly<{
  completedSessions: number
  gardenBloomCount: number
  gardenCollection: GardenCollectionSnapshot
  practiceDayKeys: ReadonlyArray<string>
  rewardedDayKeys: ReadonlyArray<string>
  snapshot: LearningSnapshot
}>

export async function decodeServerBootstrap(value: unknown): Promise<ServerBootstrap> {
  const decoded = await Schema.decodeUnknownPromise(ServerBootstrapSchema)(value)
  const rewardedDayKeys = decoded.rewardedDayKeys ?? decoded.practiceDayKeys ?? []
  const gardenRewards = LearningEngine.deriveGardenRewardLedger({
    completions: [],
    gardenBloomCount: decoded.gardenBloomCount,
    rewardedDayKeys,
  })
  const fallbackProgress = LearningEngine.deriveGardenProgress({
    completedSessions: gardenRewards.gardenBloomCount,
    snapshot: decoded.snapshot,
  })
  const fallbackAwardedFlowerIds: GardenPlantId[] = []
  for (const plant of fallbackProgress.plants) {
    if (plant.stage === 'mature') fallbackAwardedFlowerIds.push(plant.id)
  }
  const gardenCollection: GardenCollectionSnapshot = decoded.gardenCollection ?? {
    awardedFlowerIds: fallbackAwardedFlowerIds,
    bloomsPerFlower: LearningEngine.gardenBloomsPerFlower,
    catalogVersion: '1',
    flowerOrder: LearningEngine.gardenFlowerIds,
    introductionSeen: false,
  }

  return {
    completedSessions: decoded.completedSessions ?? 0,
    gardenBloomCount: gardenRewards.gardenBloomCount,
    gardenCollection,
    practiceDayKeys: decoded.practiceDayKeys ?? [],
    rewardedDayKeys: gardenRewards.rewardedDayKeys,
    snapshot: decoded.snapshot,
  }
}

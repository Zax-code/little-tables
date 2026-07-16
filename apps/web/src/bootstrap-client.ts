import { LearningEngine, type LearningSnapshot } from '@little-tables/domain'
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

const ServerBootstrapSchema = Schema.Struct({
  completedSessions: Schema.optional(Schema.NonNegativeInt),
  gardenBloomCount: Schema.optional(Schema.NonNegativeInt),
  practiceDayKeys: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  rewardedDayKeys: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  snapshot: LearningSnapshotSchema,
})

export type ServerBootstrap = Readonly<{
  completedSessions: number
  gardenBloomCount: number
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

  return {
    completedSessions: decoded.completedSessions ?? 0,
    gardenBloomCount: gardenRewards.gardenBloomCount,
    practiceDayKeys: decoded.practiceDayKeys ?? [],
    rewardedDayKeys: gardenRewards.rewardedDayKeys,
    snapshot: decoded.snapshot,
  }
}

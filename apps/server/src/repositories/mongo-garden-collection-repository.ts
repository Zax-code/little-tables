import { gardenBloomsPerFlower, gardenFlowerIds } from '@little-tables/domain'
import { Effect, Layer, Schema } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  GardenCollectionRepository,
  GardenCollectionRepositoryError,
  gardenCollectionCatalogVersion,
  personalizedFlowerOrder,
  type GardenCollectionRecord,
  type GardenCollectionRepositoryService,
} from './garden-collection-repository.js'

const GardenPlantIdSchema = Schema.Literal(...gardenFlowerIds)

const GardenCollectionDocumentSchema = Schema.Struct({
  _id: Schema.NonEmptyString,
  awardedFlowerIds: Schema.Array(GardenPlantIdSchema),
  bloomCount: Schema.NonNegativeInt,
  bloomsPerFlower: Schema.Literal(gardenBloomsPerFlower),
  catalogVersion: Schema.Literal(gardenCollectionCatalogVersion),
  createdAt: Schema.ValidDateFromSelf,
  flowerOrder: Schema.Array(GardenPlantIdSchema).pipe(
    Schema.filter(
      (order) =>
        order.length === gardenFlowerIds.length &&
        new Set(order).size === gardenFlowerIds.length &&
        gardenFlowerIds.every((id) => order.includes(id)),
      { message: () => 'Garden flower order must contain every flower exactly once' },
    ),
  ),
  introductionSeen: Schema.Boolean,
  profileId: Schema.NonEmptyString,
  rewardedDayKeys: Schema.Array(Schema.NonEmptyString),
  updatedAt: Schema.ValidDateFromSelf,
})

type GardenCollectionDocument = typeof GardenCollectionDocumentSchema.Type

const recordFrom = async (document: unknown): Promise<GardenCollectionRecord> => {
  const decoded = await Schema.decodeUnknownPromise(GardenCollectionDocumentSchema)(document)
  return {
    ...decoded,
    awardedFlowerIds: decoded.flowerOrder.filter((id) => decoded.awardedFlowerIds.includes(id)),
  }
}

const makeService = (
  client: MongoClient,
  collection: Collection<GardenCollectionDocument>,
): GardenCollectionRepositoryService => ({
  health: Effect.tryPromise({
    try: () =>
      client
        .db()
        .command({ ping: 1 })
        .then(() => undefined),
    catch: (cause) => new GardenCollectionRepositoryError({ cause, operation: 'health' }),
  }),
  loadOrCreate: ({ preferredFlowerPrefix, profileId }) =>
    Effect.tryPromise({
      try: async () => {
        const now = new Date()
        const candidate: GardenCollectionDocument = {
          _id: profileId,
          awardedFlowerIds: [],
          bloomCount: 0,
          bloomsPerFlower: gardenBloomsPerFlower,
          catalogVersion: gardenCollectionCatalogVersion,
          createdAt: now,
          flowerOrder: personalizedFlowerOrder(preferredFlowerPrefix),
          introductionSeen: false,
          profileId,
          rewardedDayKeys: [],
          updatedAt: now,
        }
        const document = await collection.findOneAndUpdate(
          { _id: profileId },
          { $setOnInsert: candidate },
          { returnDocument: 'after', upsert: true },
        )
        if (document === null) throw new Error('Garden collection upsert returned no document')
        return recordFrom(document)
      },
      catch: (cause) => new GardenCollectionRepositoryError({ cause, operation: 'load-or-create' }),
    }),
  markIntroductionSeen: (profileId) =>
    Effect.tryPromise({
      try: async () => {
        const document = await collection.findOneAndUpdate(
          { _id: profileId },
          { $set: { introductionSeen: true, updatedAt: new Date() } },
          { returnDocument: 'after' },
        )
        if (document === null) throw new Error('Garden collection does not exist')
        return recordFrom(document)
      },
      catch: (cause) =>
        new GardenCollectionRepositoryError({
          cause,
          operation: 'mark-introduction-seen',
        }),
    }),
  reconcile: (profileId, reconciliation) =>
    Effect.tryPromise({
      try: async () => {
        const document = await collection.findOneAndUpdate(
          { _id: profileId },
          {
            $addToSet: {
              awardedFlowerIds: { $each: [...reconciliation.awardedFlowerIds] },
              rewardedDayKeys: { $each: [...reconciliation.rewardedDayKeys] },
            },
            $max: { bloomCount: reconciliation.bloomCount },
            $set: { updatedAt: new Date() },
          },
          { returnDocument: 'after' },
        )
        if (document === null) throw new Error('Garden collection does not exist')
        return recordFrom(document)
      },
      catch: (cause) => new GardenCollectionRepositoryError({ cause, operation: 'reconcile' }),
    }),
})

const layer = (uri: string, databaseName = 'little_tables') =>
  Layer.scoped(
    GardenCollectionRepository,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const client = new MongoClient(uri)
          await client.connect()
          const collection = client
            .db(databaseName)
            .collection<GardenCollectionDocument>('garden_collections')
          await collection.createIndex({ profileId: 1 }, { unique: true })
          return { client, service: makeService(client, collection) }
        },
        catch: (cause) =>
          new GardenCollectionRepositoryError({ cause, operation: 'load-or-create' }),
      }),
      ({ client }) => Effect.promise(() => client.close()),
    ).pipe(Effect.map(({ service }) => service)),
  )

export const MongoGardenCollectionRepository = { layer } as const

import { Effect, Layer } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  AllowedEmailRepository,
  AllowedEmailRepositoryError,
  type AllowedEmailRepositoryService,
} from './allowed-email-repository.js'

type AllowedEmailDocument = Readonly<{
  _id: string
  addedAt: Date
  addedBy: string
}>

const makeService = (
  collection: Collection<AllowedEmailDocument>,
): AllowedEmailRepositoryService => ({
  add: (email, addedBy) =>
    Effect.tryPromise({
      try: async () => {
        const result = await collection.updateOne(
          { _id: email },
          { $setOnInsert: { _id: email, addedAt: new Date(), addedBy } },
          { upsert: true },
        )
        return result.upsertedCount === 1
      },
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'add' }),
    }),
  contains: (email) =>
    Effect.tryPromise({
      try: async () => (await collection.countDocuments({ _id: email }, { limit: 1 })) === 1,
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'contains' }),
    }),
  list: () =>
    Effect.tryPromise({
      try: async () =>
        (
          await collection
            .find({}, { projection: { _id: 1 } })
            .sort({ _id: 1 })
            .toArray()
        ).map(({ _id }) => _id),
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'list' }),
    }),
})

const layer = (uri: string, databaseName = 'little_tables') =>
  Layer.scoped(
    AllowedEmailRepository,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const client = new MongoClient(uri)
          await client.connect()
          const collection = client
            .db(databaseName)
            .collection<AllowedEmailDocument>('allowed_emails')
          return { client, service: makeService(collection) }
        },
        catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'list' }),
      }),
      ({ client }) => Effect.promise(() => client.close()),
    ).pipe(Effect.map(({ service }) => service)),
  )

export const MongoAllowedEmailRepository = { layer } as const

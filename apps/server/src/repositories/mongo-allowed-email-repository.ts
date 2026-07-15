import { Effect, Layer, Schema } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  AllowedEmailRepository,
  AllowedEmailRepositoryError,
  type AllowedEmailRepositoryService,
} from './allowed-email-repository.js'

const AllowedEmailDocumentSchema = Schema.Struct({
  _id: Schema.NonEmptyString,
  addedAt: Schema.ValidDateFromSelf,
  addedBy: Schema.NonEmptyString,
})

type AllowedEmailDocument = typeof AllowedEmailDocumentSchema.Type

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
      try: async () => {
        const documents = await collection.find().sort({ _id: 1 }).toArray()
        const decoded = await Promise.all(
          documents.map((document) =>
            Schema.decodeUnknownPromise(AllowedEmailDocumentSchema)(document),
          ),
        )
        return decoded.map(({ _id }) => _id)
      },
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

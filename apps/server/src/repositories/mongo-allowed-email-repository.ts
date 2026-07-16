import { Effect, Layer, Schema } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  AllowedEmailRepository,
  AllowedEmailRepositoryError,
  type AllowedEmailRepositoryService,
} from './allowed-email-repository.js'

const AllowedEmailDocumentSchema = Schema.Struct({
  _id: Schema.NonEmptyString,
  addedAt: Schema.optional(Schema.ValidDateFromSelf),
  addedBy: Schema.optional(Schema.NonEmptyString),
  removedAt: Schema.optional(Schema.ValidDateFromSelf),
  removedBy: Schema.optional(Schema.NonEmptyString),
  sessionVersion: Schema.optional(Schema.NonNegativeInt),
  status: Schema.optional(Schema.Literal('allowed', 'blocked')),
})

type AllowedEmailDocument = typeof AllowedEmailDocumentSchema.Type

const makeService = (
  collection: Collection<AllowedEmailDocument>,
): AllowedEmailRepositoryService => ({
  add: (email, addedBy) =>
    Effect.tryPromise({
      try: async () => {
        const previous = await collection.findOneAndUpdate(
          { _id: email },
          {
            $set: { addedAt: new Date(), addedBy, status: 'allowed' },
          },
          { returnDocument: 'before', upsert: true },
        )
        const decodedPrevious =
          previous === null
            ? null
            : await Schema.decodeUnknownPromise(AllowedEmailDocumentSchema)(previous)
        return decodedPrevious === null || decodedPrevious.status === 'blocked'
      },
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'add' }),
    }),
  contains: (email) =>
    Effect.tryPromise({
      try: async () =>
        (await collection.countDocuments(
          { _id: email, status: { $ne: 'blocked' } },
          { limit: 1 },
        )) === 1,
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'contains' }),
    }),
  isBlocked: (email) =>
    Effect.tryPromise({
      try: async () =>
        (await collection.countDocuments({ _id: email, status: 'blocked' }, { limit: 1 })) === 1,
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'isBlocked' }),
    }),
  list: () =>
    Effect.tryPromise({
      try: async () => {
        const documents = await collection
          .find({ status: { $ne: 'blocked' } })
          .sort({ _id: 1 })
          .toArray()
        const decoded = await Promise.all(
          documents.map((document) =>
            Schema.decodeUnknownPromise(AllowedEmailDocumentSchema)(document),
          ),
        )
        return decoded.map(({ _id }) => _id)
      },
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'list' }),
    }),
  listBlocked: () =>
    Effect.tryPromise({
      try: async () => {
        const documents = await collection.find({ status: 'blocked' }).sort({ _id: 1 }).toArray()
        const decoded = await Promise.all(
          documents.map((document) =>
            Schema.decodeUnknownPromise(AllowedEmailDocumentSchema)(document),
          ),
        )
        return decoded.map(({ _id }) => _id)
      },
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'listBlocked' }),
    }),
  remove: (email, removedBy) =>
    Effect.tryPromise({
      try: async () => {
        await collection.updateOne(
          { _id: email },
          {
            $inc: { sessionVersion: 1 },
            $set: { removedAt: new Date(), removedBy, status: 'blocked' },
          },
          { upsert: true },
        )
      },
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'remove' }),
    }),
  sessionVersion: (email) =>
    Effect.tryPromise({
      try: async () => {
        const document = await collection.findOne({ _id: email })
        if (document === null) return 0
        const decoded = await Schema.decodeUnknownPromise(AllowedEmailDocumentSchema)(document)
        return decoded.sessionVersion ?? 0
      },
      catch: (cause) => new AllowedEmailRepositoryError({ cause, operation: 'sessionVersion' }),
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

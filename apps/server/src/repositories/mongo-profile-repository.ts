import { Effect, Layer, Schema } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  ProfileRepository,
  ProfileRepositoryError,
  PreferredDisplayNameSchema,
  type ProfileRepositoryService,
} from './profile-repository.js'

const ProfileDocumentSchema = Schema.Struct({
  _id: Schema.NonEmptyString,
  displayName: PreferredDisplayNameSchema,
  updatedAt: Schema.ValidDateFromSelf,
})

type ProfileDocument = typeof ProfileDocumentSchema.Type

const makeService = (collection: Collection<ProfileDocument>): ProfileRepositoryService => ({
  findPreferredName: (googleSubject) =>
    Effect.tryPromise({
      try: async () => {
        const document = await collection.findOne({ _id: googleSubject })
        if (document === null) return null
        const decoded = await Schema.decodeUnknownPromise(ProfileDocumentSchema)(document)
        return decoded.displayName
      },
      catch: (cause) => new ProfileRepositoryError({ cause, operation: 'find-preferred-name' }),
    }),
  savePreferredName: (googleSubject, displayName) =>
    Effect.tryPromise({
      try: async () => {
        const document = await Schema.decodeUnknownPromise(ProfileDocumentSchema)({
          _id: googleSubject,
          displayName,
          updatedAt: new Date(),
        })
        const result = await collection.updateOne(
          { _id: document._id },
          { $setOnInsert: { displayName: document.displayName, updatedAt: document.updatedAt } },
          { upsert: true },
        )
        return result.upsertedCount === 1
      },
      catch: (cause) => new ProfileRepositoryError({ cause, operation: 'save-preferred-name' }),
    }),
})

const layer = (uri: string, databaseName = 'little_tables') =>
  Layer.scoped(
    ProfileRepository,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const client = new MongoClient(uri)
          await client.connect()
          const collection = client.db(databaseName).collection<ProfileDocument>('profiles')
          return { client, service: makeService(collection) }
        },
        catch: (cause) => new ProfileRepositoryError({ cause, operation: 'find-preferred-name' }),
      }),
      ({ client }) => Effect.promise(() => client.close()),
    ).pipe(Effect.map(({ service }) => service)),
  )

export const MongoProfileRepository = { layer } as const

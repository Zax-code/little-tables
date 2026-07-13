import type { AttemptEvent } from '@little-tables/domain'
import { Effect, Layer } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  AttemptRepository,
  AttemptRepositoryError,
  type AttemptRepositoryService,
} from './attempt-repository.js'

type AttemptDocument = Readonly<{
  _id: string
  attempt: AttemptEvent
  profileId: string
  receivedAt: Date
}>

const makeService = (
  collection: Collection<AttemptDocument>,
  inviteClaims: Collection<{ _id: string; consumedAt: Date }>,
): AttemptRepositoryService => ({
  consumeInvite: (inviteId) =>
    Effect.tryPromise({
      try: async () => {
        const previous = await inviteClaims.findOneAndUpdate(
          { _id: inviteId },
          { $setOnInsert: { consumedAt: new Date() } },
          { returnDocument: 'before', upsert: true },
        )
        return previous === null
      },
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'consume-invite' }),
    }),
  insert: (profileId, attempts) =>
    Effect.tryPromise({
      try: async () => {
        if (attempts.length === 0) return { accepted: [], duplicates: [] }
        const result = await collection.bulkWrite(
          attempts.map((attempt) => ({
            updateOne: {
              filter: { _id: attempt.eventId },
              update: {
                $setOnInsert: {
                  _id: attempt.eventId,
                  attempt,
                  profileId,
                  receivedAt: new Date(),
                },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        )
        const acceptedIndexes = new Set(Object.keys(result.upsertedIds).map(Number))
        return {
          accepted: attempts
            .filter((_, index) => acceptedIndexes.has(index))
            .map(({ eventId }) => eventId),
          duplicates: attempts
            .filter((_, index) => !acceptedIndexes.has(index))
            .map(({ eventId }) => eventId),
        }
      },
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'insert' }),
    }),
  list: (profileId) =>
    Effect.tryPromise({
      try: async () =>
        (
          await collection
            .find({ profileId })
            .sort({ 'attempt.answeredAt': 1, 'attempt.sequence': 1 })
            .toArray()
        ).map(({ attempt }) => attempt),
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'list' }),
    }),
})

const layer = (uri: string, databaseName = 'little_tables') =>
  Layer.scoped(
    AttemptRepository,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const client = new MongoClient(uri)
          await client.connect()
          const collection = client.db(databaseName).collection<AttemptDocument>('attempt_events')
          const inviteClaims = client
            .db(databaseName)
            .collection<{ _id: string; consumedAt: Date }>('invite_claims')
          await collection.createIndex({ profileId: 1, 'attempt.answeredAt': 1 })
          return { client, service: makeService(collection, inviteClaims) }
        },
        catch: (cause) => new AttemptRepositoryError({ cause, operation: 'list' }),
      }),
      ({ client }) => Effect.promise(() => client.close()),
    ).pipe(Effect.map(({ service }) => service)),
  )

export const MongoAttemptRepository = { layer } as const

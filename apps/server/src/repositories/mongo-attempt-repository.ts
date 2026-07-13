import type { AttemptEvent } from '@little-tables/domain'
import { Effect, Layer } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  AttemptRepository,
  AttemptRepositoryError,
  type AttemptRepositoryService,
  type PushSubscriptionRecord,
} from './attempt-repository.js'

type AttemptDocument = Readonly<{
  _id: string
  attempt: AttemptEvent
  profileId: string
  receivedAt: Date
}>

type PushSubscriptionDocument = PushSubscriptionRecord &
  Readonly<{
    _id: string
    updatedAt: Date
  }>

const makeService = (
  client: MongoClient,
  collection: Collection<AttemptDocument>,
  inviteClaims: Collection<{ _id: string; consumedAt: Date }>,
  pushSubscriptions: Collection<PushSubscriptionDocument>,
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
  health: Effect.tryPromise({
    try: async () => {
      await client.db().command({ ping: 1 })
    },
    catch: (cause) => new AttemptRepositoryError({ cause, operation: 'health' }),
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
  listPushSubscriptions: () =>
    Effect.tryPromise({
      try: async () =>
        (await pushSubscriptions.find().toArray()).map(
          ({ _id: _, updatedAt: __, ...record }) => record,
        ),
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'list-push-subscriptions' }),
    }),
  markPushSubscriptionSent: (endpoint, dayKey) =>
    Effect.tryPromise({
      try: async () => {
        await pushSubscriptions.updateOne(
          { _id: endpoint },
          { $set: { lastSentDayKey: dayKey, updatedAt: new Date() } },
        )
      },
      catch: (cause) =>
        new AttemptRepositoryError({ cause, operation: 'mark-push-subscription-sent' }),
    }),
  removePushSubscription: (endpoint) =>
    Effect.tryPromise({
      try: async () => {
        await pushSubscriptions.deleteOne({ _id: endpoint })
      },
      catch: (cause) =>
        new AttemptRepositoryError({ cause, operation: 'remove-push-subscription' }),
    }),
  upsertPushSubscription: (profileId, subscription) =>
    Effect.tryPromise({
      try: async () => {
        await pushSubscriptions.updateOne(
          { _id: subscription.endpoint },
          {
            $set: {
              ...subscription,
              profileId,
              updatedAt: new Date(),
            },
            $setOnInsert: { lastSentDayKey: null },
          },
          { upsert: true },
        )
      },
      catch: (cause) =>
        new AttemptRepositoryError({ cause, operation: 'upsert-push-subscription' }),
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
          const pushSubscriptions = client
            .db(databaseName)
            .collection<PushSubscriptionDocument>('push_subscriptions')
          await collection.createIndex({ profileId: 1, 'attempt.answeredAt': 1 })
          await pushSubscriptions.createIndex({ profileId: 1 })
          return {
            client,
            service: makeService(client, collection, inviteClaims, pushSubscriptions),
          }
        },
        catch: (cause) => new AttemptRepositoryError({ cause, operation: 'list' }),
      }),
      ({ client }) => Effect.promise(() => client.close()),
    ).pipe(Effect.map(({ service }) => service)),
  )

export const MongoAttemptRepository = { layer } as const

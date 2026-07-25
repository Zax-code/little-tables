import type { AttemptEvent } from '@little-tables/domain'
import { Effect, Layer, Schema } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  AttemptRepository,
  AttemptRepositoryError,
  ReminderLocaleSchema,
  type AttemptRepositoryService,
  type PushSubscriptionRecord,
} from './attempt-repository.js'

type AttemptDocument = Readonly<{
  _id: string
  attempt: AttemptEvent
  profileId: string
  receivedAt: Date
}>

type PushSubscriptionDocument = Omit<PushSubscriptionRecord, 'locale'> &
  Readonly<{
    _id: string
    locale?: unknown
    updatedAt: Date
  }>

const makeService = (
  client: MongoClient,
  collection: Collection<AttemptDocument>,
  pushSubscriptions: Collection<PushSubscriptionDocument>,
): AttemptRepositoryService => ({
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
        (await pushSubscriptions.find().toArray()).map(({ _id: _, updatedAt: __, ...record }) => ({
          ...record,
          locale: Schema.is(ReminderLocaleSchema)(record.locale) ? record.locale : 'fr',
        })),
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
  removePushSubscription: (profileId, endpoint) =>
    Effect.tryPromise({
      try: async () => {
        await pushSubscriptions.deleteOne({ _id: endpoint, profileId })
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
          const pushSubscriptions = client
            .db(databaseName)
            .collection<PushSubscriptionDocument>('push_subscriptions')
          await collection.createIndex({ profileId: 1, 'attempt.answeredAt': 1 })
          await pushSubscriptions.createIndex({ profileId: 1 })
          return {
            client,
            service: makeService(client, collection, pushSubscriptions),
          }
        },
        catch: (cause) => new AttemptRepositoryError({ cause, operation: 'list' }),
      }),
      ({ client }) => Effect.promise(() => client.close()),
    ).pipe(Effect.map(({ service }) => service)),
  )

export const MongoAttemptRepository = { layer } as const

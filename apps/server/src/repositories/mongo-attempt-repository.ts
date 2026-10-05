import type { AttemptEvent, Ce2Attempt, Ce2Preferences } from '@little-tables/domain'
import { Effect, Layer, Schema } from 'effect'
import { MongoClient, type Collection } from 'mongodb'

import {
  AttemptRepository,
  AttemptRepositoryError,
  ReminderLocaleSchema,
  type AttemptRepositoryService,
  type PushSubscriptionRecord,
} from './attempt-repository.js'

type LegacyAttemptDocument = Readonly<{
  _id: string
  attempt: AttemptEvent
  profileId: string
  receivedAt: Date
}>

type Ce2AttemptDocument = Readonly<{
  _id: string
  attempt: Ce2Attempt
  profileId: string
  receivedAt: Date
}>

type Ce2PreferencesDocument = Readonly<{
  _id: string
  enabledModules: Ce2Preferences['enabledModules']
  lastDailyFamily: Ce2Preferences['lastDailyFamily']
  processedEventIds: ReadonlyArray<string>
  profileId: string
  schemaVersion: Ce2Preferences['schemaVersion']
  updatedAt: Date
}>

type PushSubscriptionDocument = Omit<PushSubscriptionRecord, 'locale'> &
  Readonly<{
    _id: string
    locale?: unknown
    updatedAt: Date
  }>

const makeService = (
  client: MongoClient,
  legacyAttempts: Collection<LegacyAttemptDocument>,
  ce2Attempts: Collection<Ce2AttemptDocument>,
  ce2Preferences: Collection<Ce2PreferencesDocument>,
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
        const result = await legacyAttempts.bulkWrite(
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
          await legacyAttempts
            .find({ profileId })
            .sort({ 'attempt.answeredAt': 1, 'attempt.sequence': 1 })
            .toArray()
        ).map(({ attempt }) => attempt),
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'list' }),
    }),
  insertCe2: (profileId, attempts) =>
    Effect.tryPromise({
      try: async () => {
        if (attempts.length === 0) return { accepted: [], duplicates: [] }
        const result = await ce2Attempts.bulkWrite(
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
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'insert-ce2' }),
    }),
  listCe2: (profileId) =>
    Effect.tryPromise({
      try: async () =>
        (
          await ce2Attempts
            .find({ profileId })
            .sort({ 'attempt.answeredAt': 1, 'attempt.sequence': 1 })
            .toArray()
        ).map(({ attempt }) => attempt),
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'list-ce2' }),
    }),
  loadCe2Preferences: (profileId) =>
    Effect.tryPromise({
      try: async () => {
        const stored = await ce2Preferences.findOne({ _id: profileId })
        return stored === null
          ? {
              enabledModules: [],
              lastDailyFamily: null,
              schemaVersion: 'ce2-preferences/v1',
              updatedAt: new Date(0),
            }
          : {
              enabledModules: stored.enabledModules,
              lastDailyFamily: stored.lastDailyFamily,
              schemaVersion: stored.schemaVersion,
              updatedAt: stored.updatedAt,
            }
      },
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'load-ce2-preferences' }),
    }),
  mergeCe2Preferences: (profileId, updates) =>
    Effect.tryPromise({
      try: async () => {
        const accepted: string[] = []
        const duplicates: string[] = []
        for (const update of updates) {
          const result = await ce2Preferences.updateOne(
            { _id: profileId, processedEventIds: { $ne: update.eventId } },
            [
              {
                $set: {
                  enabledModules: {
                    $setUnion: [{ $ifNull: ['$enabledModules', []] }, update.enabledModules],
                  },
                  lastDailyFamily: {
                    $cond: [
                      { $lte: [{ $ifNull: ['$updatedAt', new Date(0)] }, update.updatedAt] },
                      update.lastDailyFamily,
                      '$lastDailyFamily',
                    ],
                  },
                  processedEventIds: {
                    $setUnion: [{ $ifNull: ['$processedEventIds', []] }, [update.eventId]],
                  },
                  profileId,
                  schemaVersion: 'ce2-preferences/v1',
                  updatedAt: {
                    $cond: [
                      { $lte: [{ $ifNull: ['$updatedAt', new Date(0)] }, update.updatedAt] },
                      update.updatedAt,
                      '$updatedAt',
                    ],
                  },
                },
              },
            ],
          )
          if (result.matchedCount === 1) {
            accepted.push(update.eventId)
            continue
          }
          const existing = await ce2Preferences.findOne({ _id: profileId })
          if (existing !== null) {
            duplicates.push(update.eventId)
            continue
          }
          try {
            await ce2Preferences.insertOne({
              _id: profileId,
              enabledModules: update.enabledModules,
              lastDailyFamily: update.lastDailyFamily,
              processedEventIds: [update.eventId],
              profileId,
              schemaVersion: 'ce2-preferences/v1',
              updatedAt: update.updatedAt,
            })
            accepted.push(update.eventId)
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 11000) {
              const retry = await ce2Preferences.updateOne(
                { _id: profileId, processedEventIds: { $ne: update.eventId } },
                [
                  {
                    $set: {
                      enabledModules: {
                        $setUnion: [{ $ifNull: ['$enabledModules', []] }, update.enabledModules],
                      },
                      lastDailyFamily: {
                        $cond: [
                          { $lte: [{ $ifNull: ['$updatedAt', new Date(0)] }, update.updatedAt] },
                          update.lastDailyFamily,
                          '$lastDailyFamily',
                        ],
                      },
                      processedEventIds: {
                        $setUnion: [{ $ifNull: ['$processedEventIds', []] }, [update.eventId]],
                      },
                      updatedAt: {
                        $cond: [
                          { $lte: [{ $ifNull: ['$updatedAt', new Date(0)] }, update.updatedAt] },
                          update.updatedAt,
                          '$updatedAt',
                        ],
                      },
                    },
                  },
                ],
              )
              if (retry.matchedCount === 1) accepted.push(update.eventId)
              else duplicates.push(update.eventId)
            } else {
              throw error
            }
          }
        }
        return { accepted, duplicates }
      },
      catch: (cause) => new AttemptRepositoryError({ cause, operation: 'merge-ce2-preferences' }),
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
          const legacyAttempts = client
            .db(databaseName)
            .collection<LegacyAttemptDocument>('attempt_events')
          const ce2Attempts = client
            .db(databaseName)
            .collection<Ce2AttemptDocument>('ce2_attempt_events')
          const ce2Preferences = client
            .db(databaseName)
            .collection<Ce2PreferencesDocument>('ce2_preferences')
          const pushSubscriptions = client
            .db(databaseName)
            .collection<PushSubscriptionDocument>('push_subscriptions')
          await legacyAttempts.createIndex({ profileId: 1, 'attempt.answeredAt': 1 })
          await ce2Attempts.createIndex({ profileId: 1, 'attempt.answeredAt': 1 })
          await ce2Preferences.createIndex({ profileId: 1 }, { unique: true })
          await pushSubscriptions.createIndex({ profileId: 1 })
          return {
            client,
            service: makeService(
              client,
              legacyAttempts,
              ce2Attempts,
              ce2Preferences,
              pushSubscriptions,
            ),
          }
        },
        catch: (cause) => new AttemptRepositoryError({ cause, operation: 'list' }),
      }),
      ({ client }) => Effect.promise(() => client.close()),
    ).pipe(Effect.map(({ service }) => service)),
  )

export const MongoAttemptRepository = { layer } as const

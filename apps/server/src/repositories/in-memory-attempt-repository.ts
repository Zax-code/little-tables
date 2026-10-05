import type { AttemptEvent, Ce2Attempt, Ce2Preferences } from '@little-tables/domain'
import { Effect, Layer } from 'effect'

import {
  AttemptRepository,
  type AttemptRepositoryService,
  type PushSubscriptionRecord,
} from './attempt-repository.js'

const layer = () => {
  const events = new Map<string, Readonly<{ attempt: AttemptEvent; profileId: string }>>()
  const ce2Events = new Map<string, Readonly<{ attempt: Ce2Attempt; profileId: string }>>()
  const preferenceEventIds = new Map<string, Set<string>>()
  const preferences = new Map<string, Ce2Preferences>()
  const pushSubscriptions = new Map<string, PushSubscriptionRecord>()
  const service: AttemptRepositoryService = {
    health: Effect.void,
    insert: (profileId, attempts) =>
      Effect.sync(() => {
        const accepted: string[] = []
        const duplicates: string[] = []
        for (const attempt of attempts) {
          if (events.has(attempt.eventId) || ce2Events.has(attempt.eventId)) {
            duplicates.push(attempt.eventId)
          } else {
            events.set(attempt.eventId, { attempt, profileId })
            accepted.push(attempt.eventId)
          }
        }
        return { accepted, duplicates }
      }),
    list: (profileId) =>
      Effect.sync(() =>
        [...events.values()]
          .filter((event) => event.profileId === profileId)
          .map((event) => event.attempt)
          .sort((first, second) => first.answeredAt.getTime() - second.answeredAt.getTime()),
      ),
    insertCe2: (profileId, attempts) =>
      Effect.sync(() => {
        const accepted: string[] = []
        const duplicates: string[] = []
        for (const attempt of attempts) {
          if (ce2Events.has(attempt.eventId) || events.has(attempt.eventId)) {
            duplicates.push(attempt.eventId)
          } else {
            ce2Events.set(attempt.eventId, { attempt, profileId })
            accepted.push(attempt.eventId)
          }
        }
        return { accepted, duplicates }
      }),
    listCe2: (profileId) =>
      Effect.sync(() =>
        [...ce2Events.values()]
          .filter((event) => event.profileId === profileId)
          .map((event) => event.attempt)
          .sort((first, second) => first.answeredAt.getTime() - second.answeredAt.getTime()),
      ),
    loadCe2Preferences: (profileId) =>
      Effect.sync(
        () =>
          preferences.get(profileId) ?? {
            enabledModules: [],
            lastDailyFamily: null,
            schemaVersion: 'ce2-preferences/v1',
            updatedAt: new Date(0),
          },
      ),
    mergeCe2Preferences: (profileId, updates) =>
      Effect.sync(() => {
        const processed = preferenceEventIds.get(profileId) ?? new Set<string>()
        const accepted: string[] = []
        const duplicates: string[] = []
        let current =
          preferences.get(profileId) ??
          ({
            enabledModules: [],
            lastDailyFamily: null,
            schemaVersion: 'ce2-preferences/v1',
            updatedAt: new Date(0),
          } satisfies Ce2Preferences)
        for (const update of updates) {
          if (processed.has(update.eventId)) {
            duplicates.push(update.eventId)
            continue
          }
          processed.add(update.eventId)
          accepted.push(update.eventId)
          const newest = update.updatedAt.getTime() >= current.updatedAt.getTime()
          current = {
            enabledModules: [...new Set([...current.enabledModules, ...update.enabledModules])],
            lastDailyFamily: newest ? update.lastDailyFamily : current.lastDailyFamily,
            schemaVersion: 'ce2-preferences/v1',
            updatedAt: newest ? update.updatedAt : current.updatedAt,
          }
        }
        preferenceEventIds.set(profileId, processed)
        preferences.set(profileId, current)
        return { accepted, duplicates }
      }),
    listPushSubscriptions: () => Effect.sync(() => [...pushSubscriptions.values()]),
    markPushSubscriptionSent: (endpoint, dayKey) =>
      Effect.sync(() => {
        const subscription = pushSubscriptions.get(endpoint)
        if (subscription !== undefined) {
          pushSubscriptions.set(endpoint, { ...subscription, lastSentDayKey: dayKey })
        }
      }),
    removePushSubscription: (profileId, endpoint) =>
      Effect.sync(() => {
        if (pushSubscriptions.get(endpoint)?.profileId === profileId) {
          pushSubscriptions.delete(endpoint)
        }
      }),
    upsertPushSubscription: (profileId, subscription) =>
      Effect.sync(() => {
        const existing = pushSubscriptions.get(subscription.endpoint)
        pushSubscriptions.set(subscription.endpoint, {
          ...subscription,
          lastSentDayKey: existing?.lastSentDayKey ?? null,
          profileId,
        })
      }),
  }
  return Layer.succeed(AttemptRepository, service)
}

export const InMemoryAttemptRepository = { layer } as const

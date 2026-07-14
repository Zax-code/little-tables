import type { AttemptEvent } from '@little-tables/domain'
import { Effect, Layer } from 'effect'

import {
  AttemptRepository,
  type AttemptRepositoryService,
  type PushSubscriptionRecord,
} from './attempt-repository.js'

const layer = () => {
  const events = new Map<string, Readonly<{ attempt: AttemptEvent; profileId: string }>>()
  const pushSubscriptions = new Map<string, PushSubscriptionRecord>()
  const service: AttemptRepositoryService = {
    health: Effect.void,
    insert: (profileId, attempts) =>
      Effect.sync(() => {
        const accepted: string[] = []
        const duplicates: string[] = []
        for (const attempt of attempts) {
          if (events.has(attempt.eventId)) {
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
    listPushSubscriptions: () => Effect.sync(() => [...pushSubscriptions.values()]),
    markPushSubscriptionSent: (endpoint, dayKey) =>
      Effect.sync(() => {
        const subscription = pushSubscriptions.get(endpoint)
        if (subscription !== undefined) {
          pushSubscriptions.set(endpoint, { ...subscription, lastSentDayKey: dayKey })
        }
      }),
    removePushSubscription: (endpoint) =>
      Effect.sync(() => {
        pushSubscriptions.delete(endpoint)
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

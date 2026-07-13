import type { AttemptEvent } from '@little-tables/domain'
import { Effect, Layer } from 'effect'

import { AttemptRepository, type AttemptRepositoryService } from './attempt-repository.js'

const layer = () => {
  const events = new Map<string, Readonly<{ attempt: AttemptEvent; profileId: string }>>()
  const consumedInvites = new Set<string>()
  const service: AttemptRepositoryService = {
    consumeInvite: (inviteId) =>
      Effect.sync(() => {
        if (consumedInvites.has(inviteId)) return false
        consumedInvites.add(inviteId)
        return true
      }),
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
  }
  return Layer.succeed(AttemptRepository, service)
}

export const InMemoryAttemptRepository = { layer } as const

import type { AttemptEvent } from '@little-tables/domain'
import { Effect } from 'effect'

import { AttemptRepository } from '../repositories/attempt-repository.js'

export type SyncResult = Readonly<{
  accepted: ReadonlyArray<string>
  duplicates: ReadonlyArray<string>
  rejected: ReadonlyArray<Readonly<{ eventId: string; reason: string }>>
}>

type IngestInput = Readonly<{
  attempts: ReadonlyArray<AttemptEvent>
  profileId: string
}>

const ingest = ({ attempts, profileId }: IngestInput) =>
  Effect.gen(function* () {
    const repository = yield* AttemptRepository
    const seen = new Set<string>()
    const rejected: Array<Readonly<{ eventId: string; reason: string }>> = []
    const valid: AttemptEvent[] = []

    for (const attempt of attempts) {
      if (seen.has(attempt.eventId)) {
        rejected.push({ eventId: attempt.eventId, reason: 'duplicate_in_batch' })
      } else if (attempt.selected < 0 || !Number.isInteger(attempt.selected)) {
        rejected.push({ eventId: attempt.eventId, reason: 'invalid_answer' })
      } else if (
        attempt.factKey !==
          `${Math.min(attempt.left, attempt.right)}:${Math.max(attempt.left, attempt.right)}` ||
        attempt.correct !== (attempt.selected === attempt.left * attempt.right) ||
        (attempt.answerMode === 'choice' &&
          (!attempt.choices.includes(attempt.selected) ||
            !attempt.choices.includes(attempt.left * attempt.right))) ||
        (attempt.answerMode === 'keypad' && attempt.choices.length !== 0)
      ) {
        rejected.push({ eventId: attempt.eventId, reason: 'inconsistent_attempt' })
      } else {
        seen.add(attempt.eventId)
        valid.push(attempt)
      }
    }

    const stored = yield* repository.insert(profileId, valid)
    return { ...stored, rejected } satisfies SyncResult
  })

export const AttemptIngestion = { ingest } as const

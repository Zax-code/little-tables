import { Ce2Engine, type Ce2Attempt, type Ce2PreferenceUpdate } from '@little-tables/domain'
import { Effect } from 'effect'

import { AttemptRepository } from '../repositories/attempt-repository.js'
import type { SyncResult } from './attempt-ingestion.js'

type IngestInput = Readonly<{
  attempts: ReadonlyArray<Ce2Attempt>
  preferenceUpdates: ReadonlyArray<Ce2PreferenceUpdate>
  profileId: string
}>

const ingest = ({ attempts, preferenceUpdates, profileId }: IngestInput) =>
  Effect.gen(function* () {
    const repository = yield* AttemptRepository
    const seen = new Set<string>()
    const rejected: Array<Readonly<{ eventId: string; reason: string }>> = []
    const validAttempts: Ce2Attempt[] = []
    const validPreferences: Ce2PreferenceUpdate[] = []

    for (const attempt of attempts) {
      if (seen.has(attempt.eventId)) {
        rejected.push({ eventId: attempt.eventId, reason: 'duplicate_in_batch' })
        continue
      }
      seen.add(attempt.eventId)
      if (
        attempt.questionCount > 100 ||
        attempt.sequence >= attempt.questionCount ||
        !Ce2Engine.validateQuestion(attempt.question)
      ) {
        rejected.push({ eventId: attempt.eventId, reason: 'invalid_question' })
        continue
      }
      const evaluation = Ce2Engine.evaluate({
        answer: attempt.answer,
        columnSteps: attempt.columnSteps,
        question: attempt.question,
      })
      validAttempts.push({ ...attempt, evaluation })
    }

    for (const update of preferenceUpdates) {
      if (seen.has(update.eventId)) {
        rejected.push({ eventId: update.eventId, reason: 'duplicate_in_batch' })
        continue
      }
      seen.add(update.eventId)
      validPreferences.push(update)
    }

    if (validAttempts.length + validPreferences.length > 100) {
      for (const event of [...validAttempts, ...validPreferences].slice(100)) {
        rejected.push({ eventId: event.eventId, reason: 'batch_limit_exceeded' })
      }
      validAttempts.splice(Math.min(validAttempts.length, 100))
      validPreferences.splice(Math.max(0, 100 - validAttempts.length))
    }

    if (repository.insertCe2 === undefined || repository.mergeCe2Preferences === undefined) {
      return {
        accepted: [],
        duplicates: [],
        rejected: [
          ...rejected,
          ...validAttempts.map(({ eventId }) => ({ eventId, reason: 'ce2_unavailable' })),
          ...validPreferences.map(({ eventId }) => ({ eventId, reason: 'ce2_unavailable' })),
        ],
      } satisfies SyncResult
    }

    const [storedAttempts, storedPreferences] = yield* Effect.all([
      repository.insertCe2(profileId, validAttempts),
      repository.mergeCe2Preferences(profileId, validPreferences),
    ])
    return {
      accepted: [...storedAttempts.accepted, ...storedPreferences.accepted],
      duplicates: [...storedAttempts.duplicates, ...storedPreferences.duplicates],
      rejected,
    } satisfies SyncResult
  })

export const Ce2AttemptIngestion = { ingest } as const

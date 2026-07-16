import { LearningEngine, type AttemptEvent } from '@little-tables/domain'
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
      const operation = attempt.operation ?? 'multiply'
      const validOperands =
        operation === 'multiply'
          ? attempt.left >= 1 && attempt.left <= 12 && attempt.right >= 1 && attempt.right <= 12
          : attempt.left >= 1 &&
            attempt.left <= 144 &&
            attempt.right >= 1 &&
            attempt.right <= 12 &&
            Number.isInteger(attempt.left / attempt.right) &&
            attempt.left / attempt.right >= 1 &&
            attempt.left / attempt.right <= 12
      const correctAnswer = validOperands
        ? LearningEngine.correctAnswer({
            left: attempt.left,
            operation,
            right: attempt.right,
          })
        : null
      const parsedLearningDay =
        attempt.learningDayKey === undefined
          ? null
          : new Date(`${attempt.learningDayKey}T00:00:00.000Z`)
      const validLearningDayKey =
        attempt.learningDayKey === undefined ||
        (!Number.isNaN(parsedLearningDay?.getTime()) &&
          parsedLearningDay?.toISOString().slice(0, 10) === attempt.learningDayKey)

      if (seen.has(attempt.eventId)) {
        rejected.push({ eventId: attempt.eventId, reason: 'duplicate_in_batch' })
      } else if (attempt.selected < 0 || !Number.isInteger(attempt.selected)) {
        rejected.push({ eventId: attempt.eventId, reason: 'invalid_answer' })
      } else if (
        !validOperands ||
        correctAnswer === null ||
        !validLearningDayKey ||
        attempt.factKey !==
          LearningEngine.factKey({ left: attempt.left, operation, right: attempt.right }) ||
        attempt.correct !== (attempt.selected === correctAnswer) ||
        (attempt.answerMode === 'choice' &&
          (!attempt.choices.includes(attempt.selected) ||
            !attempt.choices.includes(correctAnswer))) ||
        (attempt.answerMode === 'keypad' && attempt.choices.length !== 0) ||
        attempt.sequence >= attempt.questionCount
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

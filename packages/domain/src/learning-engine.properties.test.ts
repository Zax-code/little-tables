import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { type AttemptEvent, LearningEngine } from './learning-engine.js'

describe('LearningEngine properties', () => {
  it('always creates valid distinct choices with exactly one answer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
        const session = LearningEngine.createSession({
          now: new Date('2026-07-12T12:00:00.000Z'),
          policy: { questionCount: 25 },
          seed,
          snapshot: LearningEngine.emptySnapshot(),
        })

        for (const question of session.questions) {
          const answer = question.left * question.right
          expect(question.answerMode).toBe('choice')
          expect(question.choices).toHaveLength(4)
          expect(new Set(question.choices).size).toBe(4)
          expect(question.choices.filter((choice) => choice === answer)).toHaveLength(1)
          expect(question.choices.every(Number.isInteger)).toBe(true)
          expect(question.choices.every((choice) => choice >= 0)).toBe(true)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('never increases stability after an incorrect answer', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 60, noNaN: true }), (stabilityDays) => {
        const correctEvent: AttemptEvent = {
          answerMode: 'choice',
          answeredAt: new Date('2026-07-12T12:00:00.000Z'),
          choices: [42, 48, 54, 56],
          correct: true,
          eventId: 'correct',
          factKey: '7:8',
          latencyMs: 2000,
          left: 7,
          right: 8,
          selected: 56,
          sequence: 0,
          sessionId: 'session',
        }
        const learned = LearningEngine.reduce({
          attempts: [correctEvent],
          snapshot: LearningEngine.emptySnapshot(),
        })
        const current = learned.facts['7:8']
        if (current === undefined) throw new Error('Expected mastery')
        const custom = {
          ...learned,
          facts: { ...learned.facts, '7:8': { ...current, stabilityDays } },
        }
        const incorrect = LearningEngine.reduce({
          attempts: [
            {
              ...correctEvent,
              answeredAt: new Date('2026-07-13T12:00:00.000Z'),
              correct: false,
              eventId: 'incorrect',
              selected: 54,
            },
          ],
          snapshot: custom,
        })

        expect(incorrect.facts['7:8']?.stabilityDays).toBeLessThanOrEqual(stabilityDays)
      }),
      { numRuns: 100 },
    )
  })
})

import { describe, expect, it } from 'vitest'

import { type AttemptEvent, LearningEngine } from './learning-engine.js'

describe('LearningEngine', () => {
  it('creates a ten-question beginner session with valid answer choices', () => {
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 10 },
      seed: 42,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(session.questions).toHaveLength(10)

    for (const question of session.questions) {
      expect(question.choices).toHaveLength(4)
      expect(new Set(question.choices).size).toBe(4)
      expect(question.choices).toContain(question.left * question.right)
      expect(question.left).toBeGreaterThanOrEqual(1)
      expect(question.left).toBeLessThanOrEqual(10)
      expect(question.right).toBeGreaterThanOrEqual(1)
      expect(question.right).toBeLessThanOrEqual(10)
    }
  })

  it('answers a question and emits an immutable attempt event', () => {
    const now = new Date('2026-07-12T12:00:00.000Z')
    const session = LearningEngine.createSession({
      now,
      policy: { questionCount: 10 },
      seed: 7,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected a question')

    const result = LearningEngine.answer({
      answeredAt: new Date('2026-07-12T12:00:01.250Z'),
      eventId: 'attempt-1',
      selected: question.left * question.right,
      session,
    })

    expect(result.correct).toBe(true)
    expect(result.event).toMatchObject({
      correct: true,
      eventId: 'attempt-1',
      factKey: question.factKey,
      latencyMs: 1250,
      selected: question.left * question.right,
      sequence: 0,
      sessionId: session.id,
    })
    expect(result.session.currentIndex).toBe(1)
    expect(session.currentIndex).toBe(0)
  })

  it('reduces attempt events idempotently into spaced mastery', () => {
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 1 },
      seed: 11,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected a question')
    const attempt = LearningEngine.answer({
      answeredAt: new Date('2026-07-12T12:00:02.000Z'),
      eventId: 'attempt-idempotent',
      selected: question.left * question.right,
      session,
    }).event

    const once = LearningEngine.reduce({
      attempts: [attempt],
      snapshot: LearningEngine.emptySnapshot(),
    })
    const twice = LearningEngine.reduce({ attempts: [attempt], snapshot: once })

    expect(twice).toEqual(once)
    expect(once.facts[question.factKey]).toMatchObject({
      correctStreak: 1,
      lapseCount: 0,
      state: 'learning',
    })
    expect(once.facts[question.factKey]?.dueAt?.toISOString()).toBe('2026-07-13T12:00:02.000Z')
  })

  it('requires recall evidence on separate days before a fact becomes fluent', () => {
    const attempt = (
      eventId: string,
      answeredAt: string,
      answerMode: AttemptEvent['answerMode'],
    ): AttemptEvent => ({
      answerMode,
      answeredAt: new Date(answeredAt),
      choices: answerMode === 'choice' ? [48, 54, 56, 64] : [],
      correct: true,
      eventId,
      factKey: '7:8',
      latencyMs: 1800,
      left: 7,
      right: 8,
      selected: 56,
      sequence: Number(eventId.slice(-1)),
      sessionId: `session-${eventId}`,
    })

    const choiceOnly = LearningEngine.reduce({
      attempts: [
        attempt('event-1', '2026-07-12T12:00:00.000Z', 'choice'),
        attempt('event-2', '2026-07-13T12:00:00.000Z', 'choice'),
        attempt('event-3', '2026-07-14T12:00:00.000Z', 'choice'),
        attempt('event-4', '2026-07-15T12:00:00.000Z', 'choice'),
        attempt('event-5', '2026-07-16T12:00:00.000Z', 'choice'),
      ],
      snapshot: LearningEngine.emptySnapshot(),
    })
    const withRecall = LearningEngine.reduce({
      attempts: [
        attempt('event-6', '2026-07-17T12:00:00.000Z', 'keypad'),
        attempt('event-7', '2026-07-18T12:00:00.000Z', 'keypad'),
      ],
      snapshot: choiceOnly,
    })

    expect(choiceOnly.facts['7:8']?.state).toBe('familiar')
    expect(withRecall.facts['7:8']?.state).toBe('fluent')
  })

  it('prioritizes due facts and graduates familiar facts to keypad recall', () => {
    const baseAttempt: Omit<AttemptEvent, 'answeredAt' | 'eventId' | 'sequence'> = {
      answerMode: 'choice',
      choices: [48, 54, 56, 64],
      correct: true,
      factKey: '7:8',
      latencyMs: 1900,
      left: 7,
      right: 8,
      selected: 56,
      sessionId: 'practice-7-8',
    }
    const snapshot = LearningEngine.reduce({
      attempts: [12, 13, 14].map((day, index) => ({
        ...baseAttempt,
        answeredAt: new Date(`2026-07-${day}T12:00:00.000Z`),
        eventId: `due-${index}`,
        sequence: index,
      })),
      snapshot: LearningEngine.emptySnapshot(),
    })

    const session = LearningEngine.createSession({
      now: new Date('2026-08-01T12:00:00.000Z'),
      policy: { questionCount: 10 },
      seed: 5,
      snapshot,
    })
    const dueQuestion = session.questions.find((question) => question.factKey === '7:8')

    expect(dueQuestion).toBeDefined()
    expect(dueQuestion?.answerMode).toBe('keypad')
    expect(dueQuestion?.choices).toEqual([])
  })

  it('derives deterministic garden rewards without duplicates', () => {
    const rewards = LearningEngine.deriveRewards({
      completedSessions: 5,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(rewards.map((reward) => reward.id)).toEqual([
      'session:first-bloom',
      'session:three-daisy',
      'session:five-pink-pot',
    ])
    expect(new Set(rewards.map((reward) => reward.id)).size).toBe(rewards.length)
  })

  it('requeues a missed fact after intervening questions without lengthening the session', () => {
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 10 },
      seed: 99,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const missed = session.questions[0]
    if (missed === undefined) throw new Error('Expected a question')

    const result = LearningEngine.answer({
      answeredAt: new Date('2026-07-12T12:00:02.000Z'),
      eventId: 'missed-attempt',
      selected: missed.left * missed.right + 1,
      session,
    })

    expect(result.session.questions).toHaveLength(10)
    expect(
      result.session.questions.slice(1, 3).every(({ factKey }) => factKey !== missed.factKey),
    ).toBe(true)
    expect(result.session.questions[3]?.factKey).toBe(missed.factKey)
    expect(result.session.questions[3]?.id).not.toBe(missed.id)
  })

  it('builds a focused session with eight table questions and two mixed reviews', () => {
    const session = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { focusTable: 7, questionCount: 10 },
      seed: 19,
      snapshot: LearningEngine.emptySnapshot(),
    })

    const focused = session.questions.filter(({ left, right }) => left === 7 || right === 7)
    expect(focused).toHaveLength(8)
  })
})

import { describe, expect, it } from 'vitest'

import { type AttemptEvent, type FactMastery, LearningEngine } from './learning-engine.js'

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
      questionCount: 10,
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

  it('does not treat a fast wrong guess as improved recall latency', () => {
    const correct: AttemptEvent = {
      answerMode: 'keypad',
      answeredAt: new Date('2026-07-12T12:00:00.000Z'),
      choices: [],
      correct: true,
      eventId: 'latency-correct',
      factKey: '7:8',
      latencyMs: 1800,
      left: 7,
      questionCount: 2,
      right: 8,
      selected: 56,
      sequence: 0,
      sessionId: 'latency-session',
    }
    const learned = LearningEngine.reduce({
      attempts: [correct],
      snapshot: LearningEngine.emptySnapshot(),
    })
    const afterGuess = LearningEngine.reduce({
      attempts: [
        {
          ...correct,
          answeredAt: new Date('2026-07-12T12:01:00.000Z'),
          correct: false,
          eventId: 'latency-wrong',
          latencyMs: 100,
          selected: 54,
          sequence: 1,
        },
      ],
      snapshot: learned,
    })

    expect(afterGuess.facts['7:8']?.latencyMs).toBe(1800)
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
      questionCount: 10,
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

  it.each([
    [0, []],
    [1, ['session:first-bloom']],
    [3, ['session:first-bloom', 'session:three-daisy']],
    [5, ['session:first-bloom', 'session:three-daisy', 'session:five-pink-pot']],
    [12, ['session:first-bloom', 'session:three-daisy', 'session:five-pink-pot']],
  ] as const)(
    'derives garden progress after %i completed sessions',
    (completedSessions, rewardIds) => {
      const progress = LearningEngine.deriveGardenProgress({
        completedSessions,
        snapshot: LearningEngine.emptySnapshot(),
      })

      expect(progress.bloomCount).toBe(completedSessions)
      expect(progress.rewards.map((reward) => reward.id)).toEqual(rewardIds)
    },
  )

  it('derives the catalog-driven plant growth stages and featured reward', () => {
    const stagesAt = (completedSessions: number) =>
      LearningEngine.deriveGardenProgress({
        completedSessions,
        snapshot: LearningEngine.emptySnapshot(),
      })

    expect(stagesAt(0).plants.map(({ stage }) => stage)).toEqual([
      'dormant',
      'dormant',
      'dormant',
      'dormant',
      'dormant',
      'locked',
    ])
    expect(stagesAt(1).featuredPlant?.name).toBe('coral tulip')
    expect(stagesAt(2).plants[0]?.stage).toBe('mature')
    expect(stagesAt(12).plants.map(({ stage }) => stage)).toEqual([
      'mature',
      'mature',
      'mature',
      'mature',
      'mature',
      'locked',
    ])
    expect(stagesAt(12).featuredPlant?.name).toBe('blush tulip')
    expect(stagesAt(13).plants[5]?.stage).toBe('growing')
    expect(stagesAt(15).plants[5]?.stage).toBe('mature')
  })

  it.each([
    [0, 'coral-tulip', 1, 1, 'growing', false],
    [1, 'coral-tulip', 2, 1, 'mature', false],
    [12, 'celebration-daisy', 13, 1, 'growing', true],
    [13, 'celebration-daisy', 15, 2, 'mature', false],
  ] as const)(
    'derives the next garden milestone after %i blooms',
    (completedSessions, plantId, targetAt, bloomsRemaining, targetStage, unlocksPot) => {
      const progress = LearningEngine.deriveGardenProgress({
        completedSessions,
        snapshot: LearningEngine.emptySnapshot(),
      })

      expect(progress.nextStep).toMatchObject({
        bloomsRemaining,
        plant: { id: plantId },
        targetAt,
        targetStage,
        unlocksPot,
      })
    },
  )

  it.each([15, 16, 100])('has no next garden milestone after %i blooms', (completedSessions) => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(progress.nextStep).toBeNull()
  })

  it.each([
    [-4, 0],
    [2.9, 2],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('normalizes a completed session count of %s to %i blooms', (completedSessions, bloomCount) => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions,
      snapshot: LearningEngine.emptySnapshot(),
    })

    expect(progress.bloomCount).toBe(bloomCount)
    expect(progress.bloomCount).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(progress.bloomCount)).toBe(true)
  })

  it('keeps bloom count independent of pot and sparkle rewards', () => {
    const fluentFact: FactMastery = {
      correctCount: 5,
      correctStreak: 5,
      difficulty: 0.3,
      dueAt: null,
      lapseCount: 0,
      lastReviewedAt: null,
      latencyMs: 1_200,
      recallDayKeys: ['2026-07-11', '2026-07-12'],
      stabilityDays: 5,
      state: 'fluent',
      successfulDayKeys: ['2026-07-10', '2026-07-11', '2026-07-12'],
    }
    const snapshot = {
      ...LearningEngine.emptySnapshot(),
      facts: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [`fact-${index}`, fluentFact]),
      ),
    }

    const baseline = LearningEngine.deriveGardenProgress({
      completedSessions: 5,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const withMasteryReward = LearningEngine.deriveGardenProgress({
      completedSessions: 5,
      snapshot,
    })

    expect(baseline.bloomCount).toBe(5)
    expect(withMasteryReward.bloomCount).toBe(baseline.bloomCount)
    expect(
      baseline.rewards.filter((reward) => reward.kind !== 'flower').map(({ kind }) => kind),
    ).toEqual(['pot'])
    expect(
      withMasteryReward.rewards
        .filter((reward) => reward.kind !== 'flower')
        .map(({ kind }) => kind),
    ).toEqual(['pot', 'sparkle'])
  })

  it('keeps garden rewards deterministic, unique, and monotonic as blooms increase', () => {
    const snapshot = LearningEngine.emptySnapshot()
    const rewardIdsByMilestone = [0, 1, 3, 5, 12].map((completedSessions) => {
      const input = { completedSessions, snapshot }
      const first = LearningEngine.deriveGardenProgress(input)
      const repeated = LearningEngine.deriveGardenProgress(input)
      const rewardIds = first.rewards.map((reward) => reward.id)

      expect(repeated).toEqual(first)
      expect(first.rewards).toEqual(LearningEngine.deriveRewards(input))
      expect(new Set(rewardIds).size).toBe(rewardIds.length)

      return rewardIds
    })

    for (let index = 1; index < rewardIdsByMilestone.length; index += 1) {
      const previousRewardIds = rewardIdsByMilestone[index - 1] ?? []
      const rewardIds = rewardIdsByMilestone[index] ?? []
      expect(rewardIds.slice(0, previousRewardIds.length)).toEqual(previousRewardIds)
    }
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

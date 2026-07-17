import { describe, expect, it } from 'vitest'

import {
  type AttemptEvent,
  type FactMastery,
  LearningEngine,
  type PracticeSession,
} from './learning-engine.js'

const answerCorrectly = (
  initialSession: PracticeSession,
  startedAt: Date,
  eventPrefix: string,
  latencyMs = 1_000,
): ReadonlyArray<AttemptEvent> => {
  let session = initialSession
  const attempts: AttemptEvent[] = []

  while (session.currentIndex < session.questions.length) {
    const question = session.questions[session.currentIndex]
    if (question === undefined) throw new Error('Expected a question')
    const result = LearningEngine.answer({
      answeredAt: new Date(startedAt.getTime() + (session.currentIndex + 1) * latencyMs),
      eventId: `${eventPrefix}-${session.currentIndex}`,
      selected: question.left * question.right,
      session,
    })
    attempts.push(result.event)
    session = result.session
  }

  return attempts
}

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

  it('introduces variety in consecutive same-day standard sessions', () => {
    const now = new Date('2026-07-13T12:00:00.000Z')
    const session = LearningEngine.createSession({
      now,
      policy: { questionCount: 10 },
      seed: 41,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const firstFactKeys = new Set(session.questions.map(({ factKey }) => factKey))

    const snapshot = LearningEngine.reduce({
      attempts: answerCorrectly(session, now, 'variety'),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-13T12:01:00.000Z'),
      policy: { questionCount: 10 },
      seed: 42,
      snapshot,
    })
    const overlap = nextSession.questions.filter(({ factKey }) => firstFactKeys.has(factKey))

    expect(overlap).toHaveLength(5)
  })

  it('caps same-day overlap when the previous session was slow', () => {
    const now = new Date('2026-07-13T12:00:00.000Z')
    const session = LearningEngine.createSession({
      now,
      policy: { questionCount: 10 },
      seed: 43,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const firstFactKeys = new Set(session.questions.map(({ factKey }) => factKey))
    const snapshot = LearningEngine.reduce({
      attempts: answerCorrectly(session, now, 'slow-variety', 4_000),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-13T12:01:00.000Z'),
      policy: { questionCount: 10 },
      seed: 44,
      snapshot,
    })
    const overlap = nextSession.questions.filter(({ factKey }) => firstFactKeys.has(factKey))

    expect(overlap).toHaveLength(5)
  })

  it('prefers older review facts over facts already answered today', () => {
    const firstDay = new Date('2026-07-13T12:00:00.000Z')
    const firstSession = LearningEngine.createSession({
      now: firstDay,
      policy: { questionCount: 10 },
      seed: 71,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const firstSnapshot = LearningEngine.reduce({
      attempts: answerCorrectly(firstSession, firstDay, 'cooldown-first'),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const secondDay = new Date('2026-07-14T11:00:00.000Z')
    const secondSession = LearningEngine.createSession({
      now: secondDay,
      policy: { questionCount: 10 },
      seed: 72,
      snapshot: firstSnapshot,
    })
    const secondSnapshot = LearningEngine.reduce({
      attempts: answerCorrectly(secondSession, secondDay, 'cooldown-second'),
      snapshot: firstSnapshot,
    })
    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-14T11:01:00.000Z'),
      policy: { questionCount: 10 },
      seed: 73,
      snapshot: secondSnapshot,
    })
    const reviewed = nextSession.questions.filter(
      ({ factKey }) => secondSnapshot.facts[factKey] !== undefined,
    )

    expect(reviewed).toHaveLength(5)
    expect(
      reviewed.every(({ factKey }) =>
        secondSnapshot.facts[factKey]?.lastReviewedAt?.toISOString().startsWith('2026-07-13'),
      ),
    ).toBe(true)
  })

  it('keeps a recently missed fact in the next session', () => {
    const firstDay = new Date('2026-07-13T12:00:00.000Z')
    const firstSession = LearningEngine.createSession({
      now: firstDay,
      policy: { questionCount: 10 },
      seed: 74,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const learnedSnapshot = LearningEngine.reduce({
      attempts: answerCorrectly(firstSession, firstDay, 'weak-first'),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const easySnapshot = {
      ...learnedSnapshot,
      facts: Object.fromEntries(
        Object.entries(learnedSnapshot.facts).map(([factKey, mastery]) => [
          factKey,
          { ...mastery, difficulty: 0.3 },
        ]),
      ),
    }
    const secondDay = new Date('2026-07-14T11:00:00.000Z')
    let session = LearningEngine.createSession({
      now: secondDay,
      policy: { questionCount: 10 },
      seed: 75,
      snapshot: easySnapshot,
    })
    const attempts: AttemptEvent[] = []

    while (session.currentIndex < 5) {
      const question = session.questions[session.currentIndex]
      if (question === undefined) throw new Error('Expected a question')
      const result = LearningEngine.answer({
        answeredAt: new Date(secondDay.getTime() + (session.currentIndex + 1) * 1_000),
        eventId: `weak-lead-${session.currentIndex}`,
        selected: question.left * question.right,
        session,
      })
      attempts.push(result.event)
      session = result.session
    }

    const missed = session.questions[session.currentIndex]
    if (missed === undefined) throw new Error('Expected a question')
    expect(easySnapshot.facts[missed.factKey]).toBeDefined()
    const wrong = LearningEngine.answer({
      answeredAt: new Date(secondDay.getTime() + (session.currentIndex + 1) * 1_000),
      eventId: 'weak-miss',
      selected: missed.left * missed.right + 1,
      session,
    })
    attempts.push(wrong.event)
    session = wrong.session

    while (session.currentIndex < session.questions.length) {
      const question = session.questions[session.currentIndex]
      if (question === undefined) throw new Error('Expected a question')
      const result = LearningEngine.answer({
        answeredAt: new Date(secondDay.getTime() + (session.currentIndex + 1) * 1_000),
        eventId: `weak-finish-${session.currentIndex}`,
        selected: question.left * question.right,
        session,
      })
      attempts.push(result.event)
      session = result.session
    }

    const weakSnapshot = LearningEngine.reduce({
      attempts,
      snapshot: easySnapshot,
    })
    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-14T11:02:00.000Z'),
      policy: { questionCount: 10 },
      seed: 76,
      snapshot: weakSnapshot,
    })

    expect(nextSession.questions.some(({ factKey }) => factKey === missed.factKey)).toBe(true)
  })

  it('keeps due review as the majority while introducing unseen facts', () => {
    const firstDay = new Date('2026-07-13T12:00:00.000Z')
    const firstSession = LearningEngine.createSession({
      now: firstDay,
      policy: { questionCount: 10 },
      seed: 51,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const snapshot = LearningEngine.reduce({
      attempts: answerCorrectly(firstSession, firstDay, 'due-variety'),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-15T12:00:00.000Z'),
      policy: { questionCount: 10 },
      seed: 52,
      snapshot,
    })
    const unseen = nextSession.questions.filter(
      ({ factKey }) => snapshot.facts[factKey] === undefined,
    )

    expect(unseen).toHaveLength(3)
  })

  it('balances due review and unseen facts in a five-question session', () => {
    const firstDay = new Date('2026-07-13T12:00:00.000Z')
    const firstSession = LearningEngine.createSession({
      now: firstDay,
      policy: { questionCount: 5 },
      seed: 53,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const snapshot = LearningEngine.reduce({
      attempts: answerCorrectly(firstSession, firstDay, 'five-quick-variety'),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-15T12:00:00.000Z'),
      policy: { questionCount: 5 },
      seed: 54,
      snapshot,
    })
    const unseen = nextSession.questions.filter(
      ({ factKey }) => snapshot.facts[factKey] === undefined,
    )

    expect(unseen).toHaveLength(2)
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

    expect(
      stagesAt(0)
        .plants.slice(0, 3)
        .map(({ stage }) => stage),
    ).toEqual(['dormant', 'dormant', 'locked'])
    expect(stagesAt(1).featuredPlant?.name).toBe('rose lotus')
    expect(stagesAt(5).plants[0]?.stage).toBe('mature')
    expect(
      stagesAt(10)
        .plants.slice(0, 3)
        .map(({ stage }) => stage),
    ).toEqual(['mature', 'mature', 'locked'])
    expect(stagesAt(10).featuredPlant?.name).toBe('twilight lupine')
    expect(stagesAt(11).plants[2]?.stage).toBe('locked')
    expect(stagesAt(15).plants[2]?.stage).toBe('locked')
  })

  it.each([
    [0, 'rose-lotus', 1, 1, 'growing', false],
    [1, 'rose-lotus', 5, 4, 'mature', false],
    [10, 'velvet-foxglove', 11, 1, 'growing', true],
    [11, 'velvet-foxglove', 11, 0, 'growing', true],
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

  it.each([45, 46, 100])('has no next garden milestone after %i blooms', (completedSessions) => {
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
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions,
      snapshot: {
        ...LearningEngine.emptySnapshot(),
        facts: Object.fromEntries(
          Array.from({ length: 30 }, (_, index) => [`fact-${index}`, fluentFact]),
        ),
      },
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

  it('introduces unused facts in consecutive focused sessions', () => {
    const now = new Date('2026-07-13T12:00:00.000Z')
    const firstSession = LearningEngine.createSession({
      now,
      policy: { focusTable: 7, questionCount: 10 },
      seed: 61,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const firstFocusedKeys = new Set(
      firstSession.questions
        .filter(({ left, right }) => left === 7 || right === 7)
        .map(({ factKey }) => factKey),
    )
    const snapshot = LearningEngine.reduce({
      attempts: answerCorrectly(firstSession, now, 'focused-variety'),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const nextSession = LearningEngine.createSession({
      now: new Date('2026-07-13T12:01:00.000Z'),
      policy: { focusTable: 7, questionCount: 10 },
      seed: 62,
      snapshot,
    })
    const focused = nextSession.questions.filter(({ left, right }) => left === 7 || right === 7)
    const newlyIntroduced = focused.filter(({ factKey }) => !firstFocusedKeys.has(factKey))

    expect(focused).toHaveLength(8)
    expect(newlyIntroduced).toHaveLength(2)
  })
})

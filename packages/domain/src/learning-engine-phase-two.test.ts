import { describe, expect, it } from 'vitest'

import {
  type AttemptEvent,
  type FactMastery,
  LearningEngine,
  type PracticeSession,
} from './learning-engine.js'

const FLUENT_MASTERY: FactMastery = {
  correctCount: 5,
  correctStreak: 5,
  difficulty: 0.2,
  dueAt: null,
  lapseCount: 0,
  lastReviewedAt: null,
  latencyMs: 1_200,
  recallDayKeys: ['2026-07-15', '2026-07-16'],
  stabilityDays: 5,
  state: 'fluent',
  successfulDayKeys: ['2026-07-14', '2026-07-15', '2026-07-16'],
}

const snapshotWithFluentFacts = (count: number) => ({
  ...LearningEngine.emptySnapshot(),
  facts: Object.fromEntries(
    Array.from({ length: 10 }, (_, leftIndex) =>
      Array.from(
        { length: 10 - leftIndex },
        (_, rightOffset) => `${leftIndex + 1}:${leftIndex + rightOffset + 1}`,
      ),
    )
      .flat()
      .slice(0, count)
      .map((factKey) => [factKey, FLUENT_MASTERY]),
  ),
})

const correctAttempt = (
  eventId: string,
  answeredAt: string,
  answerMode: AttemptEvent['answerMode'] = 'choice',
): AttemptEvent => ({
  answerMode,
  answeredAt: new Date(answeredAt),
  choices: answerMode === 'choice' ? [48, 54, 56, 64] : [],
  correct: true,
  eventId,
  factKey: '7:8',
  latencyMs: 1_800,
  left: 7,
  questionCount: 2,
  right: 8,
  selected: 56,
  sequence: 0,
  sessionId: `session-${eventId}`,
})

const completeCorrectly = (
  initialSession: PracticeSession,
  startedAt: Date,
): ReadonlyArray<AttemptEvent> => {
  const attempts: AttemptEvent[] = []
  let session = initialSession

  while (session.currentIndex < session.questions.length) {
    const question = session.questions[session.currentIndex]
    if (question === undefined) throw new Error('Expected a question')
    const result = LearningEngine.answer({
      answeredAt: new Date(startedAt.getTime() + (session.currentIndex + 1) * 1_000),
      eventId: `complete-${session.currentIndex}`,
      selected: question.left * question.right,
      session,
    })
    attempts.push(result.event)
    session = result.session
  }

  return attempts
}

describe('LearningEngine phase two', () => {
  it('does not expand stability for repeated success on the same local learning day', () => {
    const first = correctAttempt('same-day-1', '2026-07-12T23:30:00.000Z')
    const repeated = correctAttempt('same-day-2', '2026-07-13T01:30:00.000Z', 'keypad')

    const snapshot = LearningEngine.reduce({
      attempts: [first, repeated],
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Asia/Tokyo',
    })

    expect(snapshot.facts['7:8']?.stabilityDays).toBe(1)
    expect(snapshot.facts['7:8']?.successfulDayKeys).toEqual(['2026-07-13'])
    expect(snapshot.facts['7:8']?.dueAt?.toISOString()).toBe('2026-07-13T23:30:00.000Z')
    expect(snapshot.facts['7:8']).toMatchObject({
      correctCount: 1,
      correctStreak: 1,
      difficulty: 0.48,
      latencyMs: 1_800,
      state: 'learning',
    })
  })

  it('treats repeated same-day answers like one piece of durable recall evidence', () => {
    const firstDay = correctAttempt('first-day', '2026-07-12T12:00:00.000Z')
    const laterDay = correctAttempt('later-day', '2026-07-13T12:00:00.000Z', 'keypad')
    const spaced = LearningEngine.reduce({
      attempts: [firstDay, laterDay],
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const repeated = LearningEngine.reduce({
      attempts: [
        firstDay,
        correctAttempt('same-day-repeat-1', '2026-07-12T12:02:00.000Z'),
        correctAttempt('same-day-repeat-2', '2026-07-12T12:04:00.000Z'),
        laterDay,
      ],
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })

    expect(repeated.facts['7:8']).toMatchObject({
      correctCount: 2,
      correctStreak: 2,
      latencyMs: 1_800,
      state: 'learning',
      successfulDayKeys: ['2026-07-12', '2026-07-13'],
    })
    expect(repeated.facts['7:8']?.difficulty).toBeCloseTo(0.46)
    expect(repeated.facts['7:8']).toEqual(spaced.facts['7:8'])
  })

  it('grows stability on a later local day and gives keypad recall stronger weight', () => {
    const initial = correctAttempt('initial', '2026-07-12T12:00:00.000Z')
    const choiceSnapshot = LearningEngine.reduce({
      attempts: [initial, correctAttempt('choice-review', '2026-07-13T12:00:00.000Z')],
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const keypadSnapshot = LearningEngine.reduce({
      attempts: [initial, correctAttempt('keypad-review', '2026-07-13T12:00:00.000Z', 'keypad')],
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })

    expect(choiceSnapshot.facts['7:8']?.stabilityDays).toBeGreaterThan(1)
    expect(keypadSnapshot.facts['7:8']?.stabilityDays).toBeGreaterThan(
      choiceSnapshot.facts['7:8']?.stabilityDays ?? Number.POSITIVE_INFINITY,
    )
  })

  it('records the session time zone and local learning day on attempt events', () => {
    const session = LearningEngine.createSession({
      now: new Date('2026-07-13T03:30:00.000Z'),
      policy: { questionCount: 1 },
      seed: 10,
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'America/New_York',
    })
    const question = session.questions[0]
    if (question === undefined) throw new Error('Expected a question')

    const result = LearningEngine.answer({
      answeredAt: new Date('2026-07-13T03:31:00.000Z'),
      eventId: 'local-day-event',
      selected: question.left * question.right,
      session,
    })

    expect(session.timeZone).toBe('America/New_York')
    expect(result.event.learningDayKey).toBe('2026-07-12')
    expect(result.event.sessionKind).toBe('extra-practice')
    const snapshot = LearningEngine.reduce({
      attempts: [result.event],
      snapshot: LearningEngine.emptySnapshot(),
    })
    expect(snapshot.facts[question.factKey]?.lastReviewedDayKey).toBe('2026-07-12')
  })

  it('derives the flexible weekly rhythm and gentle comeback in the domain', () => {
    const rhythm = LearningEngine.derivePracticeRhythm({
      activeSession: { currentIndex: 3, kind: 'daily-watering', questionCount: 8 },
      practiceDayKeys: ['2026-07-10', '2026-07-13', '2026-07-16'],
      rewardedDayKeys: ['2026-07-10', '2026-07-13'],
      todayKey: '2026-07-16',
    })

    expect(rhythm.week.map(({ dayKey }) => dayKey)).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
    ])
    expect(rhythm).toMatchObject({
      comeback: 'none',
      dailyWateringDone: false,
      petalCount: 2,
      visitsUntilBloomingWeek: 0,
      weeklyPracticeDays: 3,
    })
  })

  it('awards at most one garden bloom per learning day and never for extra practice', () => {
    const rewards = LearningEngine.deriveGardenRewardLedger({
      completions: [
        { learningDayKey: '2026-07-15', sessionKind: 'daily-watering' },
        { learningDayKey: '2026-07-15', sessionKind: 'daily-watering' },
        { learningDayKey: '2026-07-16', sessionKind: 'extra-practice' },
        { learningDayKey: '2026-07-17' },
      ],
    })

    expect(rewards).toEqual({
      gardenBloomCount: 2,
      gardenBloomsEarned: 2,
      rewardedDayKeys: ['2026-07-15', '2026-07-17'],
    })
  })

  it('creates an explicit daily watering with up to eight due facts and no unseen flood', () => {
    const firstDay = new Date('2026-07-12T12:00:00.000Z')
    const introduction = LearningEngine.createSession({
      now: firstDay,
      policy: { questionCount: 8 },
      seed: 20,
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const snapshot = LearningEngine.reduce({
      attempts: completeCorrectly(introduction, firstDay),
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })

    const watering = LearningEngine.createSession({
      now: new Date('2026-07-14T12:00:00.000Z'),
      policy: { kind: 'daily-watering' },
      seed: 21,
      snapshot,
      timeZone: 'Europe/Paris',
    })

    expect(watering.kind).toBe('daily-watering')
    expect(watering.questions).toHaveLength(8)
    expect(watering.questions.every(({ factKey }) => snapshot.facts[factKey] !== undefined)).toBe(
      true,
    )
  })

  it('keeps a smaller watering to five questions and fills from review before new facts', () => {
    const firstDay = new Date('2026-07-12T12:00:00.000Z')
    const introduction = LearningEngine.createSession({
      now: firstDay,
      policy: { questionCount: 10 },
      seed: 22,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const introduced = LearningEngine.reduce({
      attempts: completeCorrectly(introduction, firstDay),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const reviewedQuestions = introduction.questions.slice(0, 7)
    const reviewed = LearningEngine.reduce({
      attempts: reviewedQuestions.map((question, index) => ({
        answerMode: question.answerMode,
        answeredAt: new Date(`2026-07-13T12:${String(index).padStart(2, '0')}:00.000Z`),
        choices: question.choices,
        correct: true,
        eventId: `partial-review-${index}`,
        factKey: question.factKey,
        latencyMs: 1_000,
        left: question.left,
        operation: question.operation,
        questionCount: 7,
        right: question.right,
        selected: LearningEngine.correctAnswer(question),
        sequence: index,
        sessionId: 'partial-review',
      })),
      snapshot: introduced,
    })
    const dueFactKeys = new Set(introduction.questions.slice(7).map(({ factKey }) => factKey))
    const watering = LearningEngine.createSession({
      now: new Date('2026-07-13T12:10:00.000Z'),
      policy: { kind: 'daily-watering' },
      seed: 23,
      snapshot: reviewed,
    })

    expect(watering.questions).toHaveLength(5)
    expect(watering.questions.every(({ factKey }) => reviewed.facts[factKey] !== undefined)).toBe(
      true,
    )
    expect(watering.questions.filter(({ factKey }) => dueFactKeys.has(factKey))).toHaveLength(3)
  })

  it('keeps the core tables as default and unlocks tables 11 and 12 only after core stability', () => {
    const core = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: { questionCount: 20 },
      seed: 30,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const fluentTemplateSnapshot = LearningEngine.reduce({
      attempts: [12, 13, 14, 15, 16].map((day, index) =>
        correctAttempt(
          `bonus-template-${index}`,
          `2026-07-${day}T12:00:00.000Z`,
          index >= 3 ? 'keypad' : 'choice',
        ),
      ),
      snapshot: LearningEngine.emptySnapshot(),
    })
    const fluentTemplate = fluentTemplateSnapshot.facts['7:8']
    if (fluentTemplate === undefined) throw new Error('Expected fluent mastery')
    const stableCoreSnapshot = {
      ...LearningEngine.emptySnapshot(),
      facts: Object.fromEntries(
        Array.from({ length: 10 }, (_, leftIndex) =>
          Array.from(
            { length: 10 - leftIndex },
            (_, rightOffset) =>
              [`${leftIndex + 1}:${leftIndex + rightOffset + 1}`, fluentTemplate] as const,
          ),
        ).flat(),
      ),
    }
    const lockedBonus = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: {
        curriculum: { packs: ['core', 'bonus-11-12'] },
        focusTable: 12,
        questionCount: 10,
      },
      seed: 31,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const bonus = LearningEngine.createSession({
      now: new Date('2026-07-12T12:00:00.000Z'),
      policy: {
        curriculum: { packs: ['core', 'bonus-11-12'] },
        focusTable: 12,
        questionCount: 10,
      },
      seed: 32,
      snapshot: stableCoreSnapshot,
    })

    expect(core.questions.every(({ left, right }) => left <= 10 && right <= 10)).toBe(true)
    expect(lockedBonus.questions.every(({ left, right }) => left <= 10 && right <= 10)).toBe(true)
    expect(bonus.questions.filter(({ left, right }) => left === 12 || right === 12)).toHaveLength(8)
    expect(bonus.questions.every(({ operation }) => operation === 'multiply')).toBe(true)
  })

  it('provides operation-safe answers and fact keys while preserving multiplication keys', () => {
    expect(LearningEngine.correctAnswer({ left: 8, operation: 'multiply', right: 7 })).toBe(56)
    expect(LearningEngine.factKey({ left: 8, operation: 'multiply', right: 7 })).toBe('7:8')
    expect(LearningEngine.correctAnswer({ left: 56, operation: 'divide', right: 7 })).toBe(8)
    expect(LearningEngine.factKey({ left: 56, operation: 'divide', right: 7 })).toBe('divide:56:7')
    expect(() => LearningEngine.correctAnswer({ left: 55, operation: 'divide', right: 7 })).toThrow(
      RangeError,
    )
  })

  it('unlocks inverse division questions only for fluent multiplication families', () => {
    const attempts = [12, 13, 14, 15, 16].map((day, index) =>
      correctAttempt(
        `fluent-${index}`,
        `2026-07-${day}T12:00:00.000Z`,
        index >= 3 ? 'keypad' : 'choice',
      ),
    )
    const snapshot = LearningEngine.reduce({
      attempts,
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const locked = LearningEngine.createSession({
      now: new Date('2026-07-17T12:00:00.000Z'),
      policy: { curriculum: { packs: ['inverse-division'] }, questionCount: 2 },
      seed: 40,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const unlocked = LearningEngine.createSession({
      now: new Date('2026-07-17T12:00:00.000Z'),
      policy: { curriculum: { packs: ['inverse-division'] }, questionCount: 2 },
      seed: 41,
      snapshot,
    })

    expect(locked.questions).toEqual([])
    expect(unlocked.questions.map(({ factKey }) => factKey).sort()).toEqual([
      'divide:56:7',
      'divide:56:8',
    ])
    expect(unlocked.questions.every(({ operation }) => operation === 'divide')).toBe(true)
    const first = unlocked.questions[0]
    if (first === undefined) throw new Error('Expected a division question')
    const result = LearningEngine.answer({
      answeredAt: new Date('2026-07-17T12:00:01.000Z'),
      eventId: 'division-answer',
      selected: LearningEngine.correctAnswer(first),
      session: unlocked,
    })
    expect(result).toMatchObject({ correct: true, event: { operation: 'divide' } })
  })

  it('derives learner progress and per-table growth from canonical multiplication facts', () => {
    const snapshot = LearningEngine.reduce({
      attempts: [12, 13, 14, 15, 16].map((day, index) =>
        correctAttempt(
          `progress-${index}`,
          `2026-07-${day}T12:00:00.000Z`,
          index >= 3 ? 'keypad' : 'choice',
        ),
      ),
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })

    const progress = LearningEngine.deriveLearningProgress({ snapshot })

    expect(progress.facts).toEqual({
      familiar: 0,
      fluent: 1,
      growing: 0,
      total: 55,
      unseen: 54,
    })
    expect(progress.tables.find(({ table }) => table === 7)?.facts).toEqual({
      familiar: 0,
      fluent: 1,
      growing: 0,
      total: 10,
      unseen: 9,
    })
    expect(progress.tables.find(({ table }) => table === 8)?.facts.fluent).toBe(1)
  })

  it('derives explicit curriculum unlock requirements for later packs', () => {
    const locked = LearningEngine.deriveLearningProgress({
      snapshot: LearningEngine.emptySnapshot(),
    })
    const oneFluentFamily = LearningEngine.reduce({
      attempts: [12, 13, 14, 15, 16].map((day, index) =>
        correctAttempt(
          `unlock-${index}`,
          `2026-07-${day}T12:00:00.000Z`,
          index >= 3 ? 'keypad' : 'choice',
        ),
      ),
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const divisionReady = LearningEngine.deriveLearningProgress({ snapshot: oneFluentFamily })

    expect(locked.packs).toEqual({
      bonus1112: {
        current: 0,
        reason: 'core-not-stable',
        required: 55,
        unlocked: false,
      },
      core: { current: 0, reason: null, required: 0, unlocked: true },
      inverseDivision: {
        current: 0,
        reason: 'no-fluent-family',
        required: 1,
        unlocked: false,
      },
    })
    expect(divisionReady.packs.inverseDivision).toMatchObject({
      current: 1,
      reason: null,
      unlocked: true,
    })
  })

  it('includes unlocked bonus tables and inverse-division facts in learning progress', () => {
    const bonusProgress = LearningEngine.deriveLearningProgress({
      curriculum: { packs: ['core', 'bonus-11-12'] },
      snapshot: snapshotWithFluentFacts(55),
    })
    expect(bonusProgress.tables.map(({ table }) => table)).toContain(11)
    expect(bonusProgress.tables.map(({ table }) => table)).toContain(12)

    const multiplicationSnapshot = LearningEngine.reduce({
      attempts: [12, 13, 14, 15, 16].map((day, index) =>
        correctAttempt(
          `division-progress-base-${index}`,
          `2026-07-${day}T12:00:00.000Z`,
          index >= 3 ? 'keypad' : 'choice',
        ),
      ),
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const divisionSnapshot = LearningEngine.reduce({
      attempts: [
        {
          ...correctAttempt('division-progress', '2026-07-17T12:00:00.000Z'),
          choices: [7, 8, 9, 10],
          factKey: 'divide:56:7',
          left: 56,
          operation: 'divide',
          right: 7,
          selected: 8,
        },
      ],
      snapshot: multiplicationSnapshot,
      timeZone: 'Europe/Paris',
    })
    const divisionProgress = LearningEngine.deriveLearningProgress({
      curriculum: { packs: ['core', 'inverse-division'] },
      snapshot: divisionSnapshot,
    })

    expect(divisionProgress.divisionFacts).toEqual({
      familiar: 0,
      fluent: 0,
      growing: 1,
      total: 2,
      unseen: 1,
    })
  })

  it('derives a semantic celebration insight when facts become familiar', () => {
    const startingSnapshot = LearningEngine.reduce({
      attempts: [
        correctAttempt('insight-1', '2026-07-12T12:00:00.000Z'),
        correctAttempt('insight-2', '2026-07-13T12:00:00.000Z'),
      ],
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const insight = LearningEngine.deriveSessionInsight({
      attempts: [correctAttempt('insight-3', '2026-07-14T12:00:00.000Z')],
      snapshot: startingSnapshot,
      timeZone: 'Europe/Paris',
    })

    expect(insight).toEqual({
      count: 1,
      factKeys: ['7:8'],
      kind: 'facts-became-familiar',
    })
  })

  it('celebrates keypad recall when no fact crosses a mastery milestone', () => {
    const startingSnapshot = LearningEngine.reduce({
      attempts: [12, 13, 14].map((day, index) =>
        correctAttempt(`recall-start-${index}`, `2026-07-${day}T12:00:00.000Z`),
      ),
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const insight = LearningEngine.deriveSessionInsight({
      attempts: [correctAttempt('recall-now', '2026-07-15T12:00:00.000Z', 'keypad')],
      snapshot: startingSnapshot,
      timeZone: 'Europe/Paris',
    })

    expect(insight).toEqual({ count: 1, factKeys: ['7:8'], kind: 'keypad-recalls' })
  })

  it('prefers a fluent-fact milestone over the lower-level keypad insight', () => {
    const startingSnapshot = LearningEngine.reduce({
      attempts: [12, 13, 14, 15].map((day, index) =>
        correctAttempt(
          `fluent-insight-${index}`,
          `2026-07-${day}T12:00:00.000Z`,
          index === 3 ? 'keypad' : 'choice',
        ),
      ),
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const insight = LearningEngine.deriveSessionInsight({
      attempts: [correctAttempt('fluent-insight-now', '2026-07-16T12:00:00.000Z', 'keypad')],
      snapshot: startingSnapshot,
      timeZone: 'Europe/Paris',
    })

    expect(insight).toEqual({
      count: 1,
      factKeys: ['7:8'],
      kind: 'facts-became-fluent',
    })
  })

  it('recognizes when a learner recovers a fact after a mistake', () => {
    const wrong = {
      ...correctAttempt('recovery-wrong', '2026-07-12T12:00:00.000Z'),
      correct: false,
      selected: 54,
    }
    const recovered = {
      ...correctAttempt('recovery-correct', '2026-07-12T12:01:00.000Z'),
      sequence: 1,
      sessionId: wrong.sessionId,
    }

    const insight = LearningEngine.deriveSessionInsight({
      attempts: [wrong, recovered],
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })

    expect(insight).toEqual({ count: 1, factKeys: ['7:8'], kind: 'mistakes-recovered' })
  })

  it('returns a truthful practice insight when no stronger celebration applies', () => {
    const insight = LearningEngine.deriveSessionInsight({
      attempts: [correctAttempt('simple-practice', '2026-07-12T12:00:00.000Z')],
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })

    expect(insight).toEqual({ count: 1, factKeys: ['7:8'], kind: 'facts-practised' })
  })

  it('derives visual rescue strategies and uses only fluent facts for a bridge', () => {
    const anchorAttempts = [
      ...[12, 13, 14, 15, 16].map((day, index) => ({
        ...correctAttempt(
          `anchor-five-${index}`,
          `2026-07-${day}T12:00:00.000Z`,
          index >= 3 ? 'keypad' : 'choice',
        ),
        factKey: '5:8',
        left: 5,
        selected: 40,
      })),
      ...[12, 13, 14, 15, 16].map((day, index) => ({
        ...correctAttempt(
          `anchor-two-${index}`,
          `2026-07-${day}T12:00:00.000Z`,
          index >= 3 ? 'keypad' : 'choice',
        ),
        factKey: '2:8',
        left: 2,
        selected: 16,
      })),
    ]
    const snapshot = LearningEngine.reduce({
      attempts: anchorAttempts,
      snapshot: LearningEngine.emptySnapshot(),
      timeZone: 'Europe/Paris',
    })
    const question = {
      answerMode: 'keypad' as const,
      choices: [],
      factKey: '7:8',
      id: 'rescue-7-8',
      left: 7,
      operation: 'multiply' as const,
      right: 8,
    }
    const withoutAnchors = LearningEngine.deriveRescueStrategies({
      question,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const withAnchors = LearningEngine.deriveRescueStrategies({ question, snapshot })

    expect(withoutAnchors.map(({ kind }) => kind)).toEqual(['array', 'commutative-flip'])
    expect(withAnchors.find(({ kind }) => kind === 'known-fact-bridge')).toEqual({
      adjustment: { factKey: '2:8', factor: 2, product: 16 },
      anchor: { factKey: '5:8', factor: 5, product: 40 },
      commonFactor: 8,
      kind: 'known-fact-bridge',
      operator: 'add',
      targetFactor: 7,
      total: 56,
    })
  })

  it('derives three finite garden chapters and an eighteen-plant collection', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 45,
      snapshot: snapshotWithFluentFacts(30),
    })

    expect(progress.chapters.map(({ id }) => id)).toEqual([
      'sunny-meadow',
      'secret-greenhouse',
      'starlit-garden',
    ])
    expect(progress.plants).toHaveLength(18)
    expect(progress.plants.at(-1)).toMatchObject({
      chapterId: 'starlit-garden',
      id: 'sunset-sunflower',
      matureAt: 45,
      stage: 'mature',
    })
    expect(progress.collection).toEqual({ collectedCount: 18, complete: true, totalCount: 18 })
    expect(progress.chapters.every(({ stage }) => stage === 'complete')).toBe(true)
    expect(progress.nextStep).toBeNull()
  })

  it('holds each showcase plant for durable mastery while preserving daily growth', () => {
    const waiting = LearningEngine.deriveGardenProgress({
      completedSessions: 15,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const ready = LearningEngine.deriveGardenProgress({
      completedSessions: 15,
      snapshot: snapshotWithFluentFacts(5),
    })

    expect(waiting.plants.find(({ id }) => id === 'celebration-daisy')).toMatchObject({
      masteryRemaining: 5,
      stage: 'locked',
    })
    expect(waiting.nextStep).toMatchObject({
      blockedByMastery: true,
      fluentFactsRemaining: 5,
      plant: { id: 'celebration-daisy' },
      practiceDaysRemaining: 0,
    })
    expect(ready.chapters[0]).toMatchObject({ collectedCount: 6, stage: 'complete' })
    expect(ready.nextStep).toMatchObject({
      blockedByMastery: false,
      plant: { id: 'lavender-sprig' },
      practiceDaysRemaining: 1,
    })
    expect(ready.rewards.map(({ id }) => id)).toContain('chapter:sunny-meadow')
  })
})

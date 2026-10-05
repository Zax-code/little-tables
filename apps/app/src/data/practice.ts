/**
 * Practice sessions: start, answer and finish, on the device. The Rust engine (WebAssembly)
 * computes every step; the local store commits each one atomically, and the outbox carries the
 * events to the server later.
 */
import { Engine, deviceTimeZone } from '@little-tables/engine'
import type {
  LearningPathSettings,
  PracticeAnswer,
  PracticePolicy,
  PracticeSession,
  SkillId,
} from '@little-tables/engine/schema'
import { Effect } from 'effect'

import { LocalStore } from './local-store.js'
import type { ProfileState, SessionCompletion } from './schema.js'

/** The sessions the app offers, as the previous app defined them. */
export const policies = {
  bonusTable: (table: 11 | 12): PracticePolicy => ({
    curriculum: { packs: ['core', 'bonus-11-12'] },
    focusTable: table,
    questionCount: 8,
  }),
  daily: (paths: LearningPathSettings): PracticePolicy => ({
    curriculum: { paths },
    kind: 'daily-watering',
  }),
  division: (): PracticePolicy => ({
    curriculum: { packs: ['inverse-division'] },
    questionCount: 6,
  }),
  quick: (paths: LearningPathSettings): PracticePolicy => ({
    curriculum: { paths },
    questionCount: 5,
  }),
  skill: (paths: LearningPathSettings, skill: SkillId): PracticePolicy => ({
    curriculum: { paths },
    focusSkill: skill,
    questionCount: skill === 'column-addition' || skill === 'column-subtraction' ? 9 : 8,
  }),
  table: (table: number): PracticePolicy => ({ focusTable: table, questionCount: 8 }),
} as const

/** Day keys of events written without one fall back to UTC, as on the server. */
const snapshotTimeZone = 'UTC'

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now() >>> 0

/** Creates a session and makes it the active one; `null` when it would have no question. */
export const startSession = (profileId: string, policy: PracticePolicy, now = Date.now()) =>
  Effect.gen(function* () {
    const engine = yield* Engine
    const store = yield* LocalStore
    const current = yield* store.load(profileId)
    const session = yield* engine.createSession({
      now,
      policy,
      seed: randomSeed(),
      snapshot: current.snapshot,
      timeZone: deviceTimeZone(),
    })
    if (session.questions.length === 0) return null
    yield* store.update(profileId, (state) => ({
      state: {
        ...state,
        activeSession: session,
        sessionStartSnapshot: state.snapshot,
      },
    }))
    return session
  })

export type LearnerResponse =
  Readonly<{ response: PracticeAnswer }> | Readonly<{ selected: number }>

export type AnswerResult = Readonly<{
  correct: boolean
  session: PracticeSession
  state: ProfileState
}>

/** Records the answer to the active session's current question. */
export const answerQuestion = (profileId: string, response: LearnerResponse, now = Date.now()) =>
  Effect.gen(function* () {
    const engine = yield* Engine
    const store = yield* LocalStore
    const current = yield* store.load(profileId)
    const session = current.activeSession
    if (session === null) return null
    const outcome = yield* engine.answer({
      answeredAt: now,
      eventId: crypto.randomUUID(),
      session,
      ...response,
    })
    const snapshot = yield* engine.reduce({
      attempts: [outcome.event],
      snapshot: current.snapshot,
      timeZone: snapshotTimeZone,
    })
    const dayKey = outcome.event.learningDayKey
    const state = yield* store.update(profileId, (state) => ({
      events: [outcome.event],
      state: {
        ...state,
        activeSession: outcome.session,
        practiceDayKeys:
          dayKey === undefined || state.practiceDayKeys.includes(dayKey)
            ? state.practiceDayKeys
            : [...state.practiceDayKeys, dayKey],
        snapshot,
      },
    }))
    return { correct: outcome.correct, session: outcome.session, state } satisfies AnswerResult
  })

/**
 * Shows the next question: its answer time starts now, not when the previous answer was given,
 * so reading the feedback does not count as hesitation.
 */
export const continueSession = (profileId: string, now = Date.now()) =>
  Effect.flatMap(LocalStore, (store) =>
    store.update(profileId, (state) => ({
      state:
        state.activeSession === null
          ? state
          : { ...state, activeSession: { ...state.activeSession, currentQuestionStartedAt: now } },
    })),
  )

/**
 * Closes the active session once every question is answered: counts it, awards the day's bloom
 * for a daily watering and keeps a summary for the celebration. Finishing twice is harmless.
 */
export const completeSession = (profileId: string, now = Date.now()) =>
  Effect.gen(function* () {
    const engine = yield* Engine
    const store = yield* LocalStore
    const current = yield* store.load(profileId)
    const session = current.activeSession
    if (session === null || session.currentIndex < session.questions.length) {
      return current.lastCompletion
    }
    const finalQuestion = session.questions[session.questions.length - 1]
    const events = yield* store.sessionEvents(profileId, session.id)
    const finalEvent = events[events.length - 1]
    if (finalQuestion === undefined || finalEvent === undefined) return null
    const learningDayKey = finalEvent.learningDayKey ?? new Date(now).toISOString().slice(0, 10)
    const ledger = yield* engine.deriveGardenRewardLedger({
      completions: [{ learningDayKey, sessionKind: session.kind }],
      gardenBloomCount: current.gardenBloomCount,
      rewardedDayKeys: current.rewardedDayKeys,
    })
    const finalExpected =
      finalQuestion.exercise === undefined
        ? yield* engine.correctAnswer(finalQuestion)
        : yield* engine.expectedAnswer(finalQuestion.exercise)
    const learningInsight = yield* engine.deriveSessionInsight({
      attempts: events,
      snapshot: current.sessionStartSnapshot ?? current.snapshot,
      timeZone: session.timeZone,
    })
    const completion: SessionCompletion = {
      bloomNumber: ledger.gardenBloomCount,
      completedAt: now,
      correctAnswers: events.filter(({ correct }) => correct).length,
      finalCorrect: finalEvent.correct,
      finalExpected,
      gardenBloomEarned: ledger.gardenBloomsEarned === 1,
      learningDayKey,
      learningInsight,
      sessionId: session.id,
      sessionKind: session.kind,
      totalAnswers: events.length,
    }
    yield* store.update(profileId, (state) => ({
      state: {
        ...state,
        activeSession: null,
        completedSessions: state.completedSessions + 1,
        gardenBloomCount: ledger.gardenBloomCount,
        lastCompletion: completion,
        rewardedDayKeys: ledger.rewardedDayKeys,
        sessionStartSnapshot: null,
      },
    }))
    return completion
  })

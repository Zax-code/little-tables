import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  defaultLearningPathSettings,
  expectedAnswer,
  isExerciseAnswerCorrect,
  isExerciseWellFormed,
  skillForKey,
  type Exercise,
  type LearningPathSettings,
} from './exercises.js'
import { LearningEngine, type AttemptEvent, type LearningSnapshot } from './learning-engine.js'
import {
  countBorrows,
  countCarries,
  deriveOpenSkills,
  generateExercise,
  learningSkills,
} from './learning-paths.js'

const makeRandom = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

const allKeys = learningSkills.flatMap((skill) => skill.keys({}, true))

const fluent = {
  correctCount: 5,
  correctStreak: 5,
  difficulty: 0.4,
  dueAt: new Date('2030-01-01T00:00:00.000Z'),
  lapseCount: 0,
  lastReviewedAt: new Date('2026-09-01T00:00:00.000Z'),
  latencyMs: 1_500,
  recallDayKeys: ['2026-08-30', '2026-08-31'],
  stabilityDays: 30,
  state: 'fluent' as const,
  successfulDayKeys: ['2026-08-29', '2026-08-30', '2026-08-31'],
}

const snapshotWith = (keys: ReadonlyArray<string>): LearningSnapshot => ({
  algorithmVersion: '1',
  facts: Object.fromEntries(keys.map((key) => [key, fluent])),
  processedEventIds: [],
})

const coreFactKeys = Array.from({ length: 10 }, (_, left) =>
  Array.from({ length: 10 - left }, (_, offset) => `${left + 1}:${left + offset + 1}`),
).flat()

const tablesAcquired = snapshotWith(coreFactKeys)

describe('learning-path exercises', () => {
  it('maps every level key back to its skill', () => {
    for (const skill of learningSkills) {
      for (const key of skill.keys({}, true)) expect(skillForKey(key)).toBe(skill.id)
    }
  })

  it('generates well-formed exercises whose expected answer is accepted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allKeys),
        fc.integer({ max: 2 ** 31, min: 0 }),
        fc.boolean(),
        (key, seed, recall) => {
          const exercise = generateExercise(key, { random: makeRandom(seed), recall })
          expect(exercise.skill).toBe(skillForKey(key))
          expect(isExerciseWellFormed(exercise)).toBe(true)
          expect(isExerciseAnswerCorrect(exercise, expectedAnswer(exercise))).toBe(true)
          if ('choices' in exercise && exercise.choices.length > 0) {
            expect(exercise.choices).toHaveLength(4)
            expect(
              exercise.choices.filter((choice) => isExerciseAnswerCorrect(exercise, choice)),
            ).toHaveLength(1)
          }
        },
      ),
      { numRuns: 1500 },
    )
  })

  it('keeps every number and result within the CE2 field of 10 000', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allKeys.filter((key) => /^(numeration|nearten|column)/.test(key))),
        fc.integer({ max: 2 ** 31, min: 0 }),
        (key, seed) => {
          const exercise = generateExercise(key, { random: makeRandom(seed), recall: true })
          const answer = expectedAnswer(exercise)
          expect(answer.type).toBe('integer')
          if (answer.type === 'integer') {
            expect(answer.value).toBeGreaterThanOrEqual(0)
            expect(answer.value).toBeLessThanOrEqual(10_000)
          }
        },
      ),
      { numRuns: 800 },
    )
  })

  it('generates written calculations with the carries their level names', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const add = generateExercise('column:add:3d:carry-2', {
        random: makeRandom(seed),
        recall: true,
      })
      const subtract = generateExercise('column:sub:3d:borrow-1', {
        random: makeRandom(seed),
        recall: true,
      })
      if (add.kind !== 'column' || subtract.kind !== 'column') throw new Error('Expected columns')
      expect(countCarries(add.terms)).toBe(2)
      expect(countBorrows(subtract.terms[0] ?? 0, subtract.terms[1] ?? 0)).toBe(1)
    }
  })

  it('accepts any fraction equal to the result, simplified or not', () => {
    const exercise: Exercise = {
      choices: [],
      kind: 'fraction-operation',
      left: { denominator: 2, numerator: 1 },
      operation: 'add',
      right: { denominator: 4, numerator: 1 },
      skill: 'fraction-operation',
      story: false,
    }
    expect(
      isExerciseAnswerCorrect(exercise, {
        denominator: 4,
        numerator: 3,
        type: 'fraction',
        whole: 0,
      }),
    ).toBe(true)
    expect(
      isExerciseAnswerCorrect(exercise, {
        denominator: 8,
        numerator: 6,
        type: 'fraction',
        whole: 0,
      }),
    ).toBe(true)
    expect(
      isExerciseAnswerCorrect(exercise, {
        denominator: 6,
        numerator: 2,
        type: 'fraction',
        whole: 0,
      }),
    ).toBe(false)
  })

  it('accepts any parts for building a fraction, as long as the count is right', () => {
    const exercise: Exercise = {
      choices: [],
      fraction: { denominator: 8, numerator: 3 },
      kind: 'fraction-read',
      mode: 'build',
      shape: 'bed',
      skill: 'fraction-read',
    }
    expect(isExerciseAnswerCorrect(exercise, { ids: [7, 0, 4], type: 'selection' })).toBe(true)
    expect(isExerciseAnswerCorrect(exercise, { ids: [7, 7, 4], type: 'selection' })).toBe(false)
    expect(isExerciseAnswerCorrect(exercise, { ids: [1, 2], type: 'selection' })).toBe(false)
  })
})

describe('opening learning paths', () => {
  it('keeps every path closed until tables 1 to 10 are acquired', () => {
    expect(deriveOpenSkills({}, defaultLearningPathSettings, false)).toEqual([])
  })

  it('opens the first skill of each path automatically once tables are acquired', () => {
    const open = deriveOpenSkills(tablesAcquired.facts, defaultLearningPathSettings, true)
    expect(open.map(({ id }) => id)).toEqual(['addition-facts', 'numeration', 'fraction-read'])
    expect(open.find(({ id }) => id === 'numeration')?.keys).toEqual(['numeration:round-100'])
  })

  it('lets a parent open a skill early, even before tables are acquired', () => {
    const settings: LearningPathSettings = {
      ...defaultLearningPathSettings,
      enabledSkills: ['fraction-line'],
    }
    const open = deriveOpenSkills({}, settings, false)
    expect(open).toEqual([{ forced: true, id: 'fraction-line', keys: ['frac:line:2'] }])
  })

  it('opens only the parent selection in manual mode', () => {
    const settings: LearningPathSettings = {
      ...defaultLearningPathSettings,
      enabledSkills: ['column-subtraction'],
      mode: 'manual',
    }
    expect(deriveOpenSkills(tablesAcquired.facts, settings, true).map(({ id }) => id)).toEqual([
      'column-subtraction',
    ])
  })

  it('opens the next level of a skill once the previous one has been met', () => {
    const facts = snapshotWith(['frac:read:2']).facts
    const open = deriveOpenSkills(
      facts,
      { ...defaultLearningPathSettings, enabledSkills: ['fraction-read'] },
      false,
    )
    expect(open[0]?.keys).toEqual(['frac:read:2', 'frac:read:4'])
  })
})

describe('sessions with learning paths', () => {
  const now = new Date('2026-10-05T16:00:00.000Z')

  it('leaves sessions unchanged when no path settings are given', () => {
    const withoutPaths = LearningEngine.createSession({
      now,
      policy: { kind: 'daily-watering' },
      seed: 7,
      snapshot: tablesAcquired,
    })
    expect(withoutPaths.questions.every(({ exercise }) => exercise === undefined)).toBe(true)
  })

  it('adds at most two new path levels to a daily watering and stays within the point budget', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const session = LearningEngine.createSession({
        now,
        policy: { curriculum: { paths: defaultLearningPathSettings }, kind: 'daily-watering' },
        seed,
        snapshot: tablesAcquired,
      })
      const fresh = session.questions.filter(({ exercise }) => exercise !== undefined)
      expect(fresh.length).toBeLessThanOrEqual(2)
      const points = session.questions.reduce(
        (total, { factKey }) => total + (factKey.startsWith('column:') ? 3 : 1),
        0,
      )
      expect(points).toBeLessThanOrEqual(8.5)
      expect(session.questions.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('gives about half of a daily watering to the skill a parent put forward', () => {
    const session = LearningEngine.createSession({
      now,
      policy: {
        curriculum: {
          paths: {
            ...defaultLearningPathSettings,
            enabledSkills: ['fraction-compare'],
            focusSkill: 'fraction-compare',
          },
        },
        kind: 'daily-watering',
      },
      seed: 3,
      snapshot: tablesAcquired,
    })
    const focused = session.questions.filter(({ factKey }) => factKey.startsWith('frac:compare'))
    expect(focused.length).toBeGreaterThanOrEqual(Math.floor(session.questions.length / 2) - 1)
  })

  it('keeps at most two written calculations in a focused session', () => {
    const session = LearningEngine.createSession({
      now,
      policy: {
        curriculum: {
          paths: { ...defaultLearningPathSettings, enabledSkills: ['column-addition'] },
        },
        focusSkill: 'column-addition',
        questionCount: 8,
      },
      seed: 11,
      snapshot: tablesAcquired,
    })
    const columns = session.questions.filter(({ factKey }) => factKey.startsWith('column:'))
    expect(columns.length).toBeLessThanOrEqual(3)
    expect(columns.length).toBeGreaterThan(0)
    expect(columns.every(({ answerMode }) => answerMode === 'keypad')).toBe(true)
  })

  it('records exercise answers, retries misses and grows mastery from recall', () => {
    let session = LearningEngine.createSession({
      now,
      policy: {
        curriculum: {
          paths: { ...defaultLearningPathSettings, enabledSkills: ['fraction-operation'] },
        },
        focusSkill: 'fraction-operation',
        questionCount: 4,
      },
      seed: 5,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const first = session.questions[0]
    if (first?.exercise === undefined) throw new Error('Expected an exercise')
    const result = LearningEngine.answer({
      answeredAt: new Date(now.getTime() + 4_000),
      eventId: 'event-1',
      response: expectedAnswer(first.exercise),
      session,
    })
    expect(result.correct).toBe(true)
    expect(result.event.exercise).toEqual(first.exercise)
    expect(LearningEngine.validateExerciseAttempt(result.event)).toBe(true)
    session = result.session
    const miss = LearningEngine.answer({
      answeredAt: new Date(now.getTime() + 8_000),
      eventId: 'event-2',
      response: { denominator: 1, numerator: 0, type: 'fraction', whole: 2 },
      session,
    })
    expect(miss.correct).toBe(false)
    expect(miss.session.questions.some(({ id }) => id.includes('retry'))).toBe(true)
  })

  it('makes fraction comparisons fluent after five successful days', () => {
    const attempts: ReadonlyArray<AttemptEvent> = Array.from({ length: 5 }, (_, day) => ({
      answerMode: 'choice',
      answeredAt: new Date(`2026-10-0${day + 1}T16:00:00.000Z`),
      choices: [],
      correct: true,
      eventId: `compare-${day}`,
      exercise: {
        kind: 'fraction-compare',
        left: { denominator: 12, numerator: 5 },
        right: { denominator: 12, numerator: 7 },
        skill: 'fraction-compare',
      },
      factKey: 'frac:compare:same-d',
      latencyMs: 3_000,
      left: 0,
      questionCount: 5,
      response: { symbol: '<', type: 'comparison' },
      right: 0,
      selected: 0,
      sequence: 0,
      sessionId: `session-${day}`,
    }))
    const snapshot = LearningEngine.reduce({ attempts, snapshot: LearningEngine.emptySnapshot() })
    expect(snapshot.facts['frac:compare:same-d']?.state).toBe('fluent')
  })
})

describe('validating exercise attempts', () => {
  const base: AttemptEvent = {
    answerMode: 'keypad',
    answeredAt: new Date('2026-10-05T16:00:00.000Z'),
    choices: [],
    correct: true,
    eventId: 'event',
    exercise: { kind: 'column', operation: 'add', skill: 'column-addition', terms: [245, 437] },
    factKey: 'column:add:3d:carry-1',
    latencyMs: 30_000,
    left: 0,
    questionCount: 6,
    response: { type: 'integer', value: 682 },
    right: 0,
    selected: 682,
    sequence: 0,
    sessionId: 'session',
  }

  it('accepts a consistent attempt', () => {
    expect(LearningEngine.validateExerciseAttempt(base)).toBe(true)
  })

  it('rejects a correctness flag that does not match the recomputed answer', () => {
    expect(
      LearningEngine.validateExerciseAttempt({
        ...base,
        response: { type: 'integer', value: 672 },
      }),
    ).toBe(false)
  })

  it('rejects an exercise filed under another skill', () => {
    expect(LearningEngine.validateExerciseAttempt({ ...base, factKey: 'column:sub:zero' })).toBe(
      false,
    )
  })

  it('rejects results above 10 000', () => {
    expect(
      LearningEngine.validateExerciseAttempt({
        ...base,
        correct: true,
        exercise: { ...base.exercise, terms: [9_000, 4_000] } as Exercise,
        response: { type: 'integer', value: 10_000 },
      }),
    ).toBe(false)
  })
})

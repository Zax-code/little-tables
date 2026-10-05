import fc from 'fast-check'
import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { Ce2Engine } from './ce2-engine.js'
import {
  Ce2AttemptWireSchema,
  type Ce2Answer,
  type Ce2Assistance,
  type Ce2Attempt,
  type Ce2Question,
  type Ce2Skill,
  type Ce2Snapshot,
  type Ce2Tier,
} from './ce2-schemas.js'

const ALL_SKILLS: ReadonlyArray<Ce2Skill> = [
  'N1',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'P1',
  'P2',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
]

const NO_ASSISTANCE: Ce2Assistance = {
  guided: false,
  helpOpened: false,
  representationHints: 0,
  resultRevealed: false,
  switchedToFree: false,
}

const answerFor = (question: Ce2Question): Ce2Answer => question.solution

const columnSolutionFor = (question: Ce2Question): Extract<Ce2Answer, { type: 'column' }> => {
  if (question.solution.type !== 'column') throw new Error('Expected a column solution')
  return question.solution
}

const attemptFor = ({
  assistance = NO_ASSISTANCE,
  day,
  eventId,
  question,
}: Readonly<{
  assistance?: Ce2Assistance
  day: number
  eventId: string
  question: Ce2Question
}>): Ce2Attempt => {
  const answer = answerFor(question)
  const columnSteps = Ce2Engine.expectedColumnSteps(question)
  return {
    answer,
    answeredAt: new Date(`2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`),
    assistance,
    columnSteps,
    evaluation: Ce2Engine.evaluate({ answer, columnSteps, question }),
    eventId,
    latencyMs: 1_000,
    learningDayKey: `2026-10-${String(day).padStart(2, '0')}`,
    question,
    questionCount: 6,
    schemaVersion: 'ce2-attempt/v1',
    sequence: 0,
    sessionId: 'ce2-test-session',
    sessionKind: 'extra-practice',
  }
}

const masterySnapshot = (
  entries: ReadonlyArray<readonly [Ce2Skill, Ce2Tier, 'learning' | 'familiar' | 'fluent']>,
): Ce2Snapshot => ({
  ...Ce2Engine.emptySnapshot(),
  enabledModules: ['arithmetic', 'fractions'],
  mastery: Object.fromEntries(
    entries.map(([skill, tier, state]) => [
      Ce2Engine.masteryKey(skill, tier),
      {
        alignmentAutonomous: false,
        autonomousSuccessCount: state === 'learning' ? 1 : 3,
        correctCount: state === 'learning' ? 1 : 3,
        lastPracticedAt: new Date('2026-10-01T12:00:00.000Z'),
        novelSuccessKeys: [`${skill}-known`],
        procedureEvidence: [],
        producedResponseCount: 1,
        recentAutonomousResults: [true],
        representations: ['decomposition'],
        state,
        successfulDayKeys: ['2026-10-01', '2026-10-02'],
      },
    ]),
  ),
})

const LEGACY_F1_QUESTION: Ce2Question = {
  choices: [
    {
      answer: { choiceIds: ['shape-0'], type: 'selection' },
      id: 'shape-0',
      label: 'partition-0',
    },
    {
      answer: { choiceIds: ['shape-1'], type: 'selection' },
      id: 'shape-1',
      label: 'partition-1',
    },
    {
      answer: { choiceIds: ['shape-2'], type: 'selection' },
      id: 'shape-2',
      label: 'partition-2',
    },
  ],
  contentVersion: 'ce2-2026-v1',
  family: 'fraction',
  generationSeed: 5,
  id: 'ce2-f1-p1-5',
  inputConstraints: {
    denominatorMax: null,
    explicitValidation: true,
    maxDigits: null,
    maximumSelections: 3,
    minimumSelections: 1,
    numeratorMax: null,
  },
  module: 'fractions',
  noveltyKey: 'F1:shape-2:disk',
  operands: [{ denominator: 4, numerator: 1 }],
  partitions: [
    { id: 'shape-0', segmentWeights: [2, 4, 3, 3] },
    { id: 'shape-1', segmentWeights: [1, 5, 2, 4] },
    { id: 'shape-2', segmentWeights: [3, 3, 3, 3] },
  ],
  prompt: 'ce2.F1.equal-parts',
  representation: 'disk',
  requiredDenominator: null,
  responseMode: 'choice',
  schemaVersion: 'ce2-question/v1',
  skill: 'F1',
  solution: { choiceIds: ['shape-2'], type: 'selection' },
  task: 'equal-parts',
  tier: 1,
}

describe('Ce2Engine question generation', () => {
  it('generates every specified skill deterministically with a valid stable identity', () => {
    for (const skill of ALL_SKILLS) {
      const first = Ce2Engine.generateQuestion({ seed: 731, skill, tier: 3 })
      const repeated = Ce2Engine.generateQuestion({ seed: 731, skill, tier: 3 })

      expect(repeated).toEqual(first)
      expect(first.skill).toBe(skill)
      expect(first.id).toContain(skill.toLowerCase())
      expect(Ce2Engine.validateQuestion(first)).toBe(true)
    }
  })

  it('rejects a question whose client-visible solution or math payload was tampered with', () => {
    const question = Ce2Engine.generateQuestion({ seed: 4, skill: 'A2', tier: 2 })
    if (question.family !== 'integer') throw new Error('Expected an integer question')
    const tampered: Ce2Question = {
      ...question,
      solution: { type: 'integer', value: question.solution.value + 1 },
    }

    expect(Ce2Engine.validateQuestion(tampered)).toBe(false)
    expect(Ce2Engine.evaluate({ answer: tampered.solution, question: tampered })).toMatchObject({
      reason: 'invalid-question',
      status: 'incorrect',
    })
    expect(Ce2Engine.validateQuestion({ ...question, id: 'ce2-a1-p2-4' })).toBe(false)
  })

  it('still validates an exact F1 question persisted by the legacy generator', () => {
    expect(Ce2Engine.validateQuestion(LEGACY_F1_QUESTION)).toBe(true)
  })

  it('strictly rejects tampering with a persisted legacy F1 question', () => {
    const changedSolution: Ce2Question = {
      ...LEGACY_F1_QUESTION,
      solution: { choiceIds: ['shape-1'], type: 'selection' },
    }
    const changedGeometry: Ce2Question = {
      ...LEGACY_F1_QUESTION,
      partitions: LEGACY_F1_QUESTION.partitions.map((partition, index) =>
        index === 0 ? { ...partition, segmentWeights: [3, 3, 3, 3] } : partition,
      ),
    }
    const changedNovelty: Ce2Question = {
      ...LEGACY_F1_QUESTION,
      noveltyKey: 'F1:4:shape-2:disk',
    }

    for (const tampered of [changedSolution, changedGeometry, changedNovelty]) {
      expect(Ce2Engine.validateQuestion(tampered)).toBe(false)
      expect(Ce2Engine.evaluate({ answer: tampered.solution, question: tampered })).toMatchObject({
        reason: 'invalid-question',
        status: 'incorrect',
      })
    }
  })

  it('keeps generated integer calculations in the first-delivery bounds', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.constantFrom(...ALL_SKILLS.filter((skill) => /^[AS]/.test(skill))),
        (seed, skill) => {
          const question = Ce2Engine.generateQuestion({ seed, skill, tier: 4 })
          if (question.family !== 'integer' && question.family !== 'column') return
          expect(question.left).toBeGreaterThanOrEqual(0)
          expect(question.left).toBeLessThanOrEqual(999)
          expect(question.right).toBeGreaterThanOrEqual(0)
          expect(question.right).toBeLessThanOrEqual(999)
          const result =
            question.operation === 'add'
              ? question.left + question.right
              : question.left - question.right
          expect(result).toBeGreaterThanOrEqual(0)
          expect(result).toBeLessThanOrEqual(1_998)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('covers zero digits and the complete unit explicitly', () => {
    const decompositions = Array.from({ length: 24 }, (_, seed) =>
      Ce2Engine.generateQuestion({ seed, skill: 'N1', tier: 1 }),
    )
    expect(
      decompositions.some(
        (question) => question.family === 'place-value' && question.solution.units === 0,
      ),
    ).toBe(true)

    const fractions = Array.from({ length: 80 }, (_, seed) =>
      Ce2Engine.generateQuestion({ seed, skill: 'F2', tier: 4 }),
    )
    expect(
      fractions.some(
        (question) => question.solution.type === 'fraction' && question.solution.numerator === 0,
      ),
    ).toBe(true)
    expect(
      fractions.some(
        (question) =>
          question.solution.type === 'fraction' &&
          question.solution.numerator === question.solution.denominator,
      ),
    ).toBe(true)
  })

  it('keeps fraction denominators, multiple partitions, and results within the CE2 limits', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.constantFrom<Ce2Skill>('F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'),
        (seed, skill) => {
          const question = Ce2Engine.generateQuestion({ seed, skill, tier: 4 })
          const rationals =
            question.family === 'fraction'
              ? question.operands
              : question.family === 'comparison'
                ? [question.left, question.right]
                : question.family === 'number-line'
                  ? [question.target]
                  : question.family === 'length'
                    ? [question.fraction]
                    : []
          for (const rational of rationals) {
            expect(rational.denominator).toBeGreaterThan(0)
            expect(rational.denominator).toBeLessThanOrEqual(12)
            expect(rational.numerator).toBeGreaterThanOrEqual(0)
            expect(rational.numerator).toBeLessThanOrEqual(rational.denominator)
          }
          if (question.skill === 'F8' && question.family === 'fraction') {
            const [left, right] = question.operands
            if (left === undefined || right === undefined) throw new Error('Expected two operands')
            const larger = Math.max(left.denominator, right.denominator)
            const smaller = Math.min(left.denominator, right.denominator)
            expect(larger % smaller).toBe(0)
            expect(larger).toBeLessThanOrEqual(12)
            if (question.solution.type !== 'fraction') throw new Error('Expected a fraction')
            expect(
              question.solution.numerator / question.solution.denominator,
            ).toBeGreaterThanOrEqual(0)
            expect(question.solution.numerator / question.solution.denominator).toBeLessThanOrEqual(
              1,
            )
          }
        },
      ),
      { numRuns: 300 },
    )
  })

  it('never offers two equivalent values in a simple fraction QCM', () => {
    for (const skill of ['F2', 'F3'] as const) {
      for (let seed = 0; seed < 120; seed += 1) {
        const question = Ce2Engine.generateQuestion({ seed, skill, tier: 1 })
        const values = question.choices.flatMap(({ answer }) =>
          answer.type === 'fraction' ? [Ce2Engine.normalizeRational(answer)] : [],
        )
        const keys = values.map(({ denominator, numerator }) => `${numerator}/${denominator}`)
        expect(new Set(keys).size).toBe(keys.length)
      }
    }
  })

  it('moves the correct QCM answer across positions while remaining deterministic', () => {
    for (const skill of ['A1', 'F1', 'F2', 'F3', 'P1'] as const) {
      const correctPositions = new Set<number>()
      for (let seed = 0; seed < 120; seed += 1) {
        const question = Ce2Engine.generateQuestion({ seed, skill, tier: 1 })
        if (question.choices.length === 0) continue
        const position = question.choices.findIndex(
          ({ answer }) => Ce2Engine.evaluate({ answer, question }).status === 'correct',
        )
        expect(position).toBeGreaterThanOrEqual(0)
        correctPositions.add(position)
      }
      expect(correctPositions.size).toBeGreaterThan(1)
    }
  })

  it('keeps varied F1 partitions positive, comparable, and uniquely correct in every palier', () => {
    const expectedPartCounts = {
      1: [2, 3, 4],
      2: [2, 3, 4, 5, 6],
      3: [4, 6, 8, 10],
      4: [5, 6, 7, 8, 9, 10, 11, 12],
    } as const

    for (const tier of [1, 2, 3, 4] as const) {
      const observedPartCounts = new Set<number>()
      for (let seed = 0; seed < 120; seed += 1) {
        const question = Ce2Engine.generateQuestion({ seed, skill: 'F1', tier })
        if (question.family !== 'fraction' || question.solution.type !== 'selection') {
          throw new Error('Expected an equal-parts question')
        }
        const operand = question.operands[0]
        if (operand === undefined) throw new Error('Expected an F1 unit fraction')
        const partCount = operand.denominator
        observedPartCounts.add(partCount)
        const equalPartitions = question.partitions.filter(({ segmentWeights }) =>
          segmentWeights.every((weight) => weight === segmentWeights[0]),
        )

        expect(expectedPartCounts[tier]).toContain(partCount)
        expect(
          question.partitions.every(({ segmentWeights }) => segmentWeights.length === partCount),
        ).toBe(true)
        expect(
          question.partitions.every(({ segmentWeights }) =>
            segmentWeights.every((weight) => weight > 0),
          ),
        ).toBe(true)
        expect(equalPartitions).toHaveLength(1)
        expect(question.solution.choiceIds).toEqual([equalPartitions[0]?.id])
        expect(
          new Set(
            question.partitions.map(({ segmentWeights }) =>
              segmentWeights.reduce((total, weight) => total + weight, 0),
            ),
          ).size,
        ).toBe(1)
        expect(question.noveltyKey).toContain(`F1:${partCount}:`)
      }

      expect([...observedPartCounts].sort((left, right) => left - right)).toEqual(
        expectedPartCounts[tier],
      )
    }
  })

  it('varies the number of parts in F1 palier 1 questions and sessions', () => {
    const partCount = (question: Ce2Question): number => {
      if (question.family !== 'fraction' || question.skill !== 'F1') {
        throw new Error('Expected an F1 fraction question')
      }
      const operand = question.operands[0]
      if (operand === undefined) throw new Error('Expected an F1 unit fraction')
      return operand.denominator
    }
    const generatedPartCounts = new Set(
      Array.from({ length: 24 }, (_, seed) =>
        partCount(Ce2Engine.generateQuestion({ seed, skill: 'F1', tier: 1 })),
      ),
    )

    expect(generatedPartCounts.size).toBeGreaterThan(1)

    for (const questionCount of [5, 8]) {
      const session = Ce2Engine.createSession({
        kind: 'extra-practice',
        module: 'fractions',
        now: new Date('2026-10-04T12:00:00.000Z'),
        questionCount,
        seed: 42,
        skill: 'F1',
        snapshot: Ce2Engine.emptySnapshot(),
      })

      expect(new Set(session.questions.map(partCount)).size).toBeGreaterThan(1)
    }
  })

  it('provides recognition and production variants within the same palier', () => {
    for (const skill of ['A1', 'F1', 'F2', 'F3'] as const) {
      const modes = new Set(
        Array.from({ length: 12 }, (_, seed) =>
          Ce2Engine.generateQuestion({ seed, skill, tier: 1 }),
        ).map(({ responseMode }) => responseMode),
      )
      expect(modes.size).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('Ce2Engine exact evaluation and procedures', () => {
  it('accepts exact equivalent fractions, including fractional forms of zero and one', () => {
    for (const seed of [5, 8, 11, 14, 17, 20]) {
      const question = Ce2Engine.generateQuestion({ seed, skill: 'F2', tier: 3 })
      if (question.solution.type !== 'fraction') throw new Error('Expected a fraction')
      const equivalent: Ce2Answer = {
        denominator: question.solution.denominator * 2,
        numerator: question.solution.numerator * 2,
        type: 'fraction',
      }
      expect(Ce2Engine.evaluate({ answer: equivalent, question }).status).toBe('correct')
    }
  })

  it('distinguishes an exact value from a required displayed partition', () => {
    const question = Array.from({ length: 200 }, (_, seed) =>
      Ce2Engine.generateQuestion({ seed, skill: 'F2', tier: 4 }),
    ).find(({ requiredDenominator }) => requiredDenominator !== null)
    if (question?.solution.type !== 'fraction') {
      throw new Error('Expected an explicit-partition question')
    }
    const equivalent = {
      denominator: question.solution.denominator * 2,
      numerator: question.solution.numerator * 2,
      type: 'fraction' as const,
    }

    expect(Ce2Engine.evaluate({ answer: equivalent, question })).toMatchObject({
      dimensions: { value: true, format: false },
      reason: 'equivalent-needs-format',
      status: 'equivalent-needs-format',
    })
  })

  it('accepts both 1/2 and 3/6 for the 1/3 + 1/6 calculation', () => {
    const question = Array.from({ length: 100 }, (_, seed) =>
      Ce2Engine.generateQuestion({ seed, skill: 'F8', tier: 4 }),
    ).find((candidate) => {
      if (candidate.family !== 'fraction' || candidate.task !== 'add') return false
      const [left, right] = candidate.operands
      return (
        left?.numerator === 1 &&
        left.denominator === 3 &&
        right?.numerator === 1 &&
        right.denominator === 6
      )
    })
    if (question === undefined) throw new Error('Expected 1/3 + 1/6')

    expect(
      Ce2Engine.evaluate({
        answer: { denominator: 2, numerator: 1, type: 'fraction' },
        question,
      }).status,
    ).toBe('correct')
    expect(
      Ce2Engine.evaluate({
        answer: { denominator: 6, numerator: 3, type: 'fraction' },
        question,
      }).status,
    ).toBe('correct')
  })

  it('evaluates exact fraction ordering and preserves P2 intermediate work', () => {
    const ordering = Ce2Engine.generateQuestion({ seed: 0, skill: 'F4', tier: 2 })
    if (ordering.family !== 'ordering') {
      throw new Error('Expected an ordering question')
    }
    expect(ordering.items.map(({ id }) => id)).not.toEqual(ordering.solution.orderedIds)
    expect(Ce2Engine.evaluate({ answer: ordering.solution, question: ordering })).toMatchObject({
      dimensions: { ordering: true },
      status: 'correct',
    })
    expect(
      Ce2Engine.evaluate({
        answer: { orderedIds: [...ordering.solution.orderedIds].reverse(), type: 'ordering' },
        question: ordering,
      }),
    ).toMatchObject({ dimensions: { ordering: false }, status: 'incorrect' })

    const problem = Ce2Engine.generateQuestion({ seed: 4, skill: 'P2', tier: 2 })
    if (problem.family !== 'problem' || problem.solution.type !== 'problem') {
      throw new Error('Expected a two-step problem')
    }
    expect(problem.solution.intermediateResults).toHaveLength(1)
    expect(Ce2Engine.evaluate({ answer: problem.solution, question: problem })).toMatchObject({
      dimensions: { intermediate: true, value: true },
      status: 'correct',
    })
    expect(
      Ce2Engine.evaluate({
        answer: {
          ...problem.solution,
          intermediateResults: [(problem.solution.intermediateResults[0] ?? 0) + 1],
        },
        question: problem,
      }),
    ).toMatchObject({ dimensions: { intermediate: false }, status: 'incorrect' })
  })

  it('models the requested carry, millier, and successive-exchange examples', () => {
    const additions = Array.from({ length: 100 }, (_, seed) =>
      Ce2Engine.generateQuestion({ seed, skill: 'A5', tier: 4 }),
    )
    const sum = additions.find(
      (question) => question.family === 'column' && question.left === 678 && question.right === 459,
    )
    if (sum === undefined) throw new Error('Expected 678 + 459')
    const sumSolution = columnSolutionFor(sum)
    expect(sumSolution.value).toBe(1_137)
    expect(sumSolution.alignment.some(({ column }) => column === 'hundreds')).toBe(true)

    const subtractions = Array.from({ length: 100 }, (_, seed) =>
      Ce2Engine.generateQuestion({ seed, skill: 'S5', tier: 4 }),
    )
    const difference = subtractions.find(
      (question) => question.family === 'column' && question.left === 600 && question.right === 247,
    )
    if (difference === undefined) {
      throw new Error('Expected 600 - 247')
    }
    expect(columnSolutionFor(difference).value).toBe(353)
    expect(difference).toMatchObject({ requiresExchange: true, zeroBridge: true })
  })

  it('evaluates autonomous column alignment separately from the result', () => {
    const question = Array.from({ length: 40 }, (_, seed) =>
      Ce2Engine.generateQuestion({ seed, skill: 'A5', tier: 1 }),
    ).find((candidate) => candidate.family === 'column' && candidate.mode === 'autonomous')
    if (question === undefined) {
      throw new Error('Expected an autonomous column question')
    }
    const solution = columnSolutionFor(question)
    const wrongAlignment: Ce2Answer = {
      alignment: solution.alignment.slice(1),
      type: 'column',
      value: solution.value,
    }

    expect(Ce2Engine.evaluate({ answer: wrongAlignment, question })).toMatchObject({
      dimensions: { alignment: false, value: true },
      reason: 'wrong-alignment',
      status: 'incorrect',
    })
  })

  it('requires every carry or exchange step to match the exact column algorithm', () => {
    const question = Ce2Engine.generateQuestion({ seed: 7, skill: 'S5', tier: 4 })
    if (question.family !== 'column') {
      throw new Error('Expected a column question')
    }
    const expectedSteps = Ce2Engine.expectedColumnSteps(question)
    const correct = Ce2Engine.evaluate({
      answer: question.solution,
      columnSteps: expectedSteps,
      question,
    })
    const first = expectedSteps[0]
    if (first === undefined) throw new Error('Expected procedure steps')
    const wrongSteps = [
      { ...first, resultDigit: (first.resultDigit + 1) % 10 },
      ...expectedSteps.slice(1),
    ]
    const wrongProcedure = Ce2Engine.evaluate({
      answer: question.solution,
      columnSteps: wrongSteps,
      question,
    })

    expect(correct).toMatchObject({ dimensions: { procedure: true }, status: 'correct' })
    expect(wrongProcedure).toMatchObject({
      dimensions: { procedure: false, value: true },
      status: 'correct',
    })
  })
})

describe('Ce2Engine mastery and scheduling', () => {
  it('requires autonomous success on three days, novel examples, and two representations', () => {
    const attempts = Array.from({ length: 6 }, (_, index) => {
      const question = Ce2Engine.generateQuestion({ seed: index, skill: 'F2', tier: 3 })
      return attemptFor({ day: 1 + Math.floor(index / 2), eventId: `fraction-${index}`, question })
    })
    const snapshot = Ce2Engine.reduce({ attempts, snapshot: Ce2Engine.emptySnapshot() })
    const mastery = snapshot.mastery[Ce2Engine.masteryKey('F2', 3)]

    expect(mastery).toMatchObject({
      autonomousSuccessCount: 6,
      producedResponseCount: 2,
      state: 'fluent',
    })
    expect(mastery?.successfulDayKeys).toHaveLength(3)
    expect(mastery?.novelSuccessKeys.length).toBeGreaterThanOrEqual(3)
    expect([...(mastery?.representations ?? [])].sort()).toEqual(['bar', 'disk'])
  })

  it('records assisted work but does not treat revelation as autonomous evidence', () => {
    const question = Ce2Engine.generateQuestion({ seed: 3, skill: 'F2', tier: 3 })
    const attempts = Array.from({ length: 8 }, (_, index) =>
      attemptFor({
        assistance: { ...NO_ASSISTANCE, helpOpened: true, resultRevealed: true },
        day: 1 + (index % 4),
        eventId: `assisted-${index}`,
        question: Ce2Engine.generateQuestion({ seed: index, skill: 'F2', tier: 3 }),
      }),
    )
    attempts.push(attemptFor({ day: 5, eventId: 'one-independent', question }))
    const snapshot = Ce2Engine.reduce({ attempts, snapshot: Ce2Engine.emptySnapshot() })
    const mastery = snapshot.mastery[Ce2Engine.masteryKey('F2', 3)]

    expect(mastery?.correctCount).toBe(9)
    expect(mastery?.autonomousSuccessCount).toBe(1)
    expect(mastery?.state).not.toBe('fluent')
  })

  it('records an equivalent required-partition response as correct value evidence', () => {
    const question = Array.from({ length: 100 }, (_, seed) =>
      Ce2Engine.generateQuestion({ seed, skill: 'F2', tier: 4 }),
    ).find(({ requiredDenominator }) => requiredDenominator !== null)
    if (question?.solution.type !== 'fraction') throw new Error('Expected a fraction question')
    const answer: Ce2Answer = {
      denominator: question.solution.denominator * 2,
      numerator: question.solution.numerator * 2,
      type: 'fraction',
    }
    const original = attemptFor({ day: 1, eventId: 'equivalent-format', question })
    const attempt: Ce2Attempt = {
      ...original,
      answer,
      evaluation: Ce2Engine.evaluate({ answer, question }),
    }
    const snapshot = Ce2Engine.reduce({ attempts: [attempt], snapshot: Ce2Engine.emptySnapshot() })
    const mastery = snapshot.mastery[Ce2Engine.masteryKey('F2', 4)]

    expect(attempt.evaluation.status).toBe('equivalent-needs-format')
    expect(mastery).toMatchObject({ autonomousSuccessCount: 1, correctCount: 1 })
  })

  it('allows recognition to establish familiarity but requires a produced response for fluency', () => {
    const recognitionSeeds = [1, 2, 4, 5, 7, 8, 10, 11]
    const attempts = recognitionSeeds.map((seed, index) =>
      attemptFor({
        day: 1 + Math.floor(index / 2),
        eventId: `recognition-${index}`,
        question: Ce2Engine.generateQuestion({ seed, skill: 'F3', tier: 3 }),
      }),
    )
    const snapshot = Ce2Engine.reduce({ attempts, snapshot: Ce2Engine.emptySnapshot() })
    const mastery = snapshot.mastery[Ce2Engine.masteryKey('F3', 3)]

    expect(mastery?.state).toBe('familiar')
    expect(mastery?.producedResponseCount).toBe(0)
  })

  it('does not count a replayed event twice', () => {
    const question = Ce2Engine.generateQuestion({ seed: 9, skill: 'A2', tier: 2 })
    const attempt = attemptFor({ day: 1, eventId: 'idempotent-event', question })
    const first = Ce2Engine.reduce({ attempts: [attempt], snapshot: Ce2Engine.emptySnapshot() })
    const replayed = Ce2Engine.reduce({ attempts: [attempt], snapshot: first })

    expect(replayed).toEqual(first)
  })

  it('derives guided column evidence from the question instead of client assistance flags', () => {
    const attempts = [1, 2, 4, 5, 7, 8].map((seed, index) => {
      const question = Ce2Engine.generateQuestion({ seed, skill: 'A5', tier: 1 })
      if (question.family !== 'column' || question.mode !== 'guided') {
        throw new Error('Expected a guided column variant')
      }
      return attemptFor({ day: 1 + Math.floor(index / 2), eventId: `guided-${seed}`, question })
    })
    const snapshot = Ce2Engine.reduce({ attempts, snapshot: Ce2Engine.emptySnapshot() })
    const mastery = snapshot.mastery[Ce2Engine.masteryKey('A5', 1)]

    expect(mastery?.correctCount).toBe(6)
    expect(mastery?.autonomousSuccessCount).toBe(0)
    expect(mastery?.state).toBe('learning')
  })

  it('passes the N1 baseline after one autonomous constructed verification', () => {
    const question = Ce2Engine.generateQuestion({ seed: 1, skill: 'N1', tier: 1 })
    const snapshot = Ce2Engine.reduce({
      attempts: [attemptFor({ day: 1, eventId: 'n1-baseline', question })],
      snapshot: Ce2Engine.emptySnapshot(),
    })

    expect(snapshot.mastery[Ce2Engine.masteryKey('N1', 1)]?.state).toBe('familiar')
    const next = Ce2Engine.createSession({
      kind: 'daily-watering',
      module: 'arithmetic',
      now: new Date('2026-10-02T12:00:00.000Z'),
      seed: 2,
      snapshot,
    })
    expect(next.questions.filter(({ skill }) => skill === 'A1')).toHaveLength(2)
  })

  it('limits a daily frontier to two questions and keeps discovery centered on five', () => {
    const snapshot = masterySnapshot([
      ['N1', 1, 'familiar'],
      ['A1', 1, 'familiar'],
    ])
    const daily = Ce2Engine.createSession({
      kind: 'daily-watering',
      module: 'arithmetic',
      now: new Date('2026-10-04T12:00:00.000Z'),
      questionCount: 8,
      seed: 42,
      snapshot,
    })
    expect(daily.questions).toHaveLength(8)
    expect(daily.questions.filter(({ skill }) => skill === 'A2')).toHaveLength(2)
    expect(
      new Set(daily.questions.filter(({ skill }) => skill === 'A2').map(({ skill }) => skill)).size,
    ).toBe(1)

    const discovery = Ce2Engine.createSession({
      kind: 'discovery',
      module: 'fractions',
      now: new Date('2026-10-04T12:00:00.000Z'),
      seed: 43,
      skill: 'F8',
      snapshot,
    })
    expect(discovery.questions).toHaveLength(5)
    expect(discovery.questions.every(({ skill }) => skill === 'F8')).toBe(true)
  })

  it('introduces at most two exercises from the next palier of an already known skill', () => {
    const snapshot = masterySnapshot([
      ['N1', 1, 'familiar'],
      ['A1', 1, 'familiar'],
    ])
    const daily = Ce2Engine.createSession({
      kind: 'daily-watering',
      module: 'arithmetic',
      now: new Date('2026-10-05T12:00:00.000Z'),
      questionCount: 8,
      seed: 51,
      skill: 'A1',
      snapshot,
    })

    expect(daily.questions.filter(({ skill, tier }) => skill === 'A1' && tier === 2)).toHaveLength(
      2,
    )
    expect(daily.questions.filter(({ tier }) => tier === 2)).toHaveLength(2)
    expect(daily.questions.filter(({ tier }) => tier === 1)).toHaveLength(6)
  })

  it('offers at least three autonomous column examples in every skill palier', () => {
    for (const skill of ['A5', 'S5'] as const) {
      for (const tier of [1, 2, 3, 4] as const) {
        const autonomousNovelty = new Set(
          Array.from({ length: 120 }, (_, seed) =>
            Ce2Engine.generateQuestion({ seed, skill, tier }),
          )
            .filter((question) => question.family === 'column' && question.mode === 'autonomous')
            .map(({ noveltyKey }) => noveltyKey),
        )

        expect(autonomousNovelty.size).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('makes fluent column mastery reachable in every palier', () => {
    for (const skill of ['A5', 'S5'] as const) {
      for (const tier of [1, 2, 3, 4] as const) {
        const byNovelty = new Map<string, Ce2Question>()
        for (let seed = 0; seed < 120; seed += 1) {
          const question = Ce2Engine.generateQuestion({ seed, skill, tier })
          if (question.family === 'column' && question.mode === 'autonomous') {
            byNovelty.set(question.noveltyKey, question)
          }
        }
        const unique = [...byNovelty.values()]
        const targeted = unique.find(
          (question) =>
            question.family === 'column' &&
            (skill === 'A5' ? question.requiresCarry : question.requiresExchange),
        )
        if (targeted === undefined) throw new Error(`Expected targeted ${skill} procedure`)
        const selected = [
          targeted,
          ...unique.filter(({ noveltyKey }) => noveltyKey !== targeted.noveltyKey),
        ].slice(0, 3)
        const attempts = Array.from({ length: 6 }, (_, index) => {
          const question = selected[index % selected.length]
          if (question === undefined) throw new Error('Expected three column examples')
          return attemptFor({
            day: 1 + Math.floor(index / 2),
            eventId: `${skill}-${tier}-${index}`,
            question,
          })
        })
        const snapshot = Ce2Engine.reduce({ attempts, snapshot: Ce2Engine.emptySnapshot() })

        expect(snapshot.mastery[Ce2Engine.masteryKey(skill, tier)]?.state).toBe('fluent')
      }
    }
  })

  it('rotates enabled daily families and persists a bounded 5-8 question plan', () => {
    let snapshot = Ce2Engine.emptySnapshot()
    const sequence: Ce2DailyPlanResult[] = []
    for (let index = 0; index < 3; index += 1) {
      const plan = Ce2Engine.scheduleDaily({
        enabledFamilies: ['tables', 'arithmetic', 'fractions'],
        now: new Date(`2026-10-0${index + 1}T12:00:00.000Z`),
        questionCount: index === 0 ? 2 : 20,
        seed: 0,
        snapshot,
      })
      sequence.push({ primaryFamily: plan.primaryFamily, questionCount: plan.questionCount })
      snapshot = Ce2Engine.recordDailyPlan({ plan, snapshot })
    }

    expect(sequence.map(({ primaryFamily }) => primaryFamily)).toEqual([
      'tables',
      'arithmetic',
      'fractions',
    ])
    expect(sequence.map(({ questionCount }) => questionCount)).toEqual([5, 8, 8])
  })
})

type Ce2DailyPlanResult = Readonly<{
  primaryFamily: 'tables' | 'arithmetic' | 'fractions'
  questionCount: number
}>

describe('CE2 persistence contracts', () => {
  it('round-trips an attempt through the ISO-date wire schema', () => {
    const question = Ce2Engine.generateQuestion({ seed: 3, skill: 'A1', tier: 1 })
    const attempt = attemptFor({ day: 1, eventId: 'wire-event', question })
    const encoded = Schema.encodeSync(Ce2AttemptWireSchema)(attempt)
    const decoded = Schema.decodeUnknownSync(Ce2AttemptWireSchema)(encoded)

    expect(encoded.answeredAt).toBe('2026-10-01T12:00:00.000Z')
    expect(decoded).toEqual(attempt)
  })

  it('merges module activation by union and takes rotation from the newest preference', () => {
    const arithmetic = {
      enabledModules: ['arithmetic'] as const,
      lastDailyFamily: 'arithmetic' as const,
      schemaVersion: 'ce2-preferences/v1' as const,
      updatedAt: new Date('2026-10-01T12:00:00.000Z'),
    }
    const fractions = {
      enabledModules: ['fractions'] as const,
      lastDailyFamily: 'fractions' as const,
      schemaVersion: 'ce2-preferences/v1' as const,
      updatedAt: new Date('2026-10-02T12:00:00.000Z'),
    }

    expect(Ce2Engine.mergePreferences([fractions, arithmetic])).toEqual({
      ...fractions,
      enabledModules: ['fractions', 'arithmetic'],
    })
  })
})

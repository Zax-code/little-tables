import type {
  Ce2Answer,
  Ce2Assistance,
  Ce2Attempt,
  Ce2ColumnName,
  Ce2ColumnStep,
  Ce2DailyFamily,
  Ce2DailyPlan,
  Ce2Draft,
  Ce2Evaluation,
  Ce2Module,
  Ce2Preferences,
  Ce2PreferenceUpdate,
  Ce2Question,
  Ce2Rational,
  Ce2Representation,
  Ce2Session,
  Ce2Skill,
  Ce2SkillMastery,
  Ce2Snapshot,
  Ce2Tier,
} from './ce2-schemas.js'
import { CE2_CONTENT_VERSION, CE2_MASTERY_ALGORITHM_VERSION } from './ce2-schemas.js'

const arithmeticSkills = [
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
] as const satisfies ReadonlyArray<Ce2Skill>
const fractionSkills = [
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
] as const satisfies ReadonlyArray<Ce2Skill>

const skillPrerequisites: Readonly<Partial<Record<Ce2Skill, ReadonlyArray<Ce2Skill>>>> = {
  A1: ['N1'],
  A2: ['A1'],
  A3: ['A2'],
  A4: ['A3'],
  A5: ['A3'],
  F2: ['F1'],
  F3: ['F2'],
  F4: ['F3'],
  F5: ['F2'],
  F6: ['F5'],
  F7: ['F2'],
  F8: ['F3', 'F7'],
  F9: ['F7'],
  P1: ['A2', 'S2'],
  P2: ['P1'],
  S1: ['N1'],
  S2: ['S1'],
  S3: ['S2'],
  S4: ['S3'],
  S5: ['S3'],
}

const masteryKey = (skill: Ce2Skill, tier: Ce2Tier): string => `${skill}:p${tier}`

const makeRandom = (initialSeed: number): (() => number) => {
  let state = initialSeed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

const pick = <A>(values: ReadonlyArray<A>, random: () => number): A => {
  const value = values[Math.floor(random() * values.length)]
  if (value === undefined) throw new Error('Cannot choose from an empty collection')
  return value
}

const integer = (random: () => number, minimum: number, maximum: number): number =>
  minimum + Math.floor(random() * (maximum - minimum + 1))

const shuffle = <A>(values: ReadonlyArray<A>, random: () => number): ReadonlyArray<A> => {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const value = shuffled[index]
    shuffled[index] = shuffled[other] as A
    shuffled[other] = value as A
  }
  return shuffled
}

const gcd = (first: number, second: number): number => {
  let left = Math.abs(first)
  let right = Math.abs(second)
  while (right !== 0) [left, right] = [right, left % right]
  return left || 1
}

const normalizeRational = ({ denominator, numerator }: Ce2Rational): Ce2Rational => {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new RangeError('Fractions require integer numerators and positive integer denominators')
  }
  const divisor = gcd(numerator, denominator)
  return { denominator: denominator / divisor, numerator: numerator / divisor }
}

const rationalKey = (value: Ce2Rational): string => {
  const normalized = normalizeRational(value)
  return `${normalized.numerator}/${normalized.denominator}`
}

const compareRational = (left: Ce2Rational, right: Ce2Rational): -1 | 0 | 1 => {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator
  return difference < 0 ? -1 : difference > 0 ? 1 : 0
}

const addRational = (left: Ce2Rational, right: Ce2Rational): Ce2Rational =>
  normalizeRational({
    denominator: left.denominator * right.denominator,
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
  })

const subtractRational = (left: Ce2Rational, right: Ce2Rational): Ce2Rational =>
  normalizeRational({
    denominator: left.denominator * right.denominator,
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
  })

const moduleForSkill = (skill: Ce2Skill): Ce2Module =>
  skill.startsWith('F') ? 'fractions' : 'arithmetic'

const representationFor = (
  skill: Ce2Skill,
  seed: number,
  fallback: Ce2Representation,
): Ce2Representation => {
  if (skill === 'F1' || skill === 'F2' || skill === 'F3' || skill === 'F4') {
    return seed % 2 === 0 ? 'bar' : 'disk'
  }
  if (skill === 'F7' || skill === 'F8' || skill === 'F9') {
    return seed % 2 === 0 ? 'bar' : 'part-whole'
  }
  return fallback
}

const alignmentFor = (
  value: number,
  operand: 'left' | 'right',
): Extract<Ce2Answer, { type: 'column' }>['alignment'] => {
  const columns: ReadonlyArray<readonly [Ce2ColumnName, number]> = [
    ['hundreds', Math.floor(value / 100) % 10],
    ['tens', Math.floor(value / 10) % 10],
    ['units', value % 10],
  ]
  const first = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return columns.slice(first).map(([column, digit]) => ({ column, digit, operand }))
}

const answerLabel = (answer: Ce2Answer): string => {
  switch (answer.type) {
    case 'integer':
      return String(answer.value)
    case 'fraction':
      return `${answer.numerator}/${answer.denominator}`
    case 'comparison':
      return answer.relation === 'less' ? '<' : answer.relation === 'greater' ? '>' : '='
    case 'operation':
      return answer.operation === 'add' ? '+' : '−'
    case 'selection':
      return answer.choiceIds.join(',')
    case 'place-value':
      return `${answer.hundreds}c ${answer.tens}d ${answer.units}u`
    case 'number-line':
      return String(answer.tick)
    case 'length':
      return `${answer.whole} + ${answer.numerator}/${answer.denominator}`
    case 'column':
      return String(answer.value)
    case 'ordering':
      return answer.orderedIds.join(' < ')
    case 'problem':
      return answer.operation === null
        ? String(answer.value ?? '')
        : answer.operation === 'add'
          ? '+'
          : '−'
  }
}

const choices = (answers: ReadonlyArray<Ce2Answer>): Ce2Question['choices'] =>
  answers.map((answer, index) => ({ answer, id: `choice-${index}`, label: answerLabel(answer) }))

const integerChoices = (answer: number, random: () => number): Ce2Question['choices'] => {
  const candidates = [
    answer,
    Math.max(0, answer - 1),
    answer + 1,
    Math.max(0, answer - 10),
    answer + 10,
    Math.max(0, answer - 100),
    answer + 100,
  ]
  const unique = [...new Set(candidates)]
  const wrong = unique.filter((value) => value !== answer)
  const selected: number[] = []
  while (selected.length < 3 && wrong.length > 0) {
    const index = Math.floor(random() * wrong.length)
    const value = wrong.splice(index, 1)[0]
    if (value !== undefined) selected.push(value)
  }
  return choices(
    shuffle([answer, ...selected], random).map((value) => ({ type: 'integer', value })),
  )
}

const fractionChoices = (
  expected: Ce2Rational,
  distractors: ReadonlyArray<Ce2Rational>,
  random: () => number,
): Ce2Question['choices'] => {
  const values = [expected, ...distractors]
  const seen = new Set<string>()
  const distinct = values.filter((value) => {
    const key = rationalKey(value)
    if (seen.has(key) || value.numerator < 0 || value.numerator > value.denominator) return false
    seen.add(key)
    return true
  })
  let numerator = 0
  while (distinct.length < 4) {
    const fallback = { denominator: 12, numerator }
    if (!seen.has(rationalKey(fallback))) {
      seen.add(rationalKey(fallback))
      distinct.push(fallback)
    }
    numerator += 1
  }
  return choices(
    shuffle(distinct.slice(0, 4), random).map(({ denominator, numerator: value }) => ({
      denominator,
      numerator: value,
      type: 'fraction' as const,
    })),
  )
}

type QuestionBaseInput = Readonly<{
  choices?: Ce2Question['choices']
  noveltyKey: string
  prompt: string
  representation: Ce2Representation
  requiredDenominator?: number | null
  responseMode: Ce2Question['responseMode']
  seed: number
  skill: Ce2Skill
  tier: Ce2Tier
}>

const questionBase = ({
  choices: questionChoices = [],
  noveltyKey,
  prompt,
  representation,
  requiredDenominator = null,
  responseMode,
  seed,
  skill,
  tier,
}: QuestionBaseInput) => ({
  choices: questionChoices,
  contentVersion: CE2_CONTENT_VERSION,
  generationSeed: seed,
  id: `ce2-${skill.toLowerCase()}-p${tier}-${seed}`,
  inputConstraints: {
    denominatorMax: responseMode === 'fraction' || responseMode === 'length' ? 12 : null,
    explicitValidation: true as const,
    maxDigits:
      responseMode === 'keypad' || responseMode === 'column' || responseMode === 'problem'
        ? 4
        : null,
    maximumSelections:
      responseMode === 'choice' || responseMode === 'multi-select'
        ? Math.max(1, questionChoices.length)
        : null,
    minimumSelections: responseMode === 'choice' || responseMode === 'multi-select' ? 1 : null,
    numeratorMax: responseMode === 'fraction' || responseMode === 'length' ? 12 : null,
  },
  module: moduleForSkill(skill),
  noveltyKey,
  prompt,
  representation,
  requiredDenominator,
  responseMode,
  schemaVersion: 'ce2-question/v1' as const,
  skill,
  tier,
})

const generatePlaceValue = (tier: Ce2Tier, seed: number): Ce2Question => {
  const examples = [462, 402, 70, 999, 105, 10, 908, 0]
  const value = examples[Math.abs(seed) % examples.length] ?? 462
  const solution = {
    hundreds: Math.floor(value / 100),
    tens: Math.floor(value / 10) % 10,
    type: 'place-value' as const,
    units: value % 10,
  }
  return {
    ...questionBase({
      noveltyKey: `N1:${value}`,
      prompt: 'ce2.N1.decompose',
      representation: tier <= 2 ? 'blocks' : 'decomposition',
      responseMode: 'place-value',
      seed,
      skill: 'N1',
      tier,
    }),
    family: 'place-value',
    solution,
    value,
  }
}

const makeIntegerQuestion = (
  skill: Extract<Ce2Skill, `A${number}` | `S${number}`>,
  tier: Ce2Tier,
  seed: number,
  left: number,
  right: number,
  operation: 'add' | 'subtract',
  strategy: 'place-value' | 'landmark' | 'compensation' | 'direct',
): Ce2Question => {
  const random = makeRandom(seed)
  const value = operation === 'add' ? left + right : left - right
  const responseMode = Math.abs(seed) % 3 === 0 ? 'keypad' : 'choice'
  return {
    ...questionBase({
      choices: responseMode === 'choice' ? integerChoices(value, random) : [],
      noveltyKey: `${skill}:${left}:${operation}:${right}`,
      prompt: `ce2.${skill}.${operation}`,
      representation: strategy === 'place-value' ? 'decomposition' : 'number-line',
      responseMode,
      seed,
      skill,
      tier,
    }),
    family: 'integer',
    left,
    operation,
    right,
    solution: { type: 'integer', value },
    strategy,
  }
}

const noRegroupAddition = (random: () => number): readonly [number, number] => {
  const hundredsLeft = integer(random, 1, 8)
  const tensLeft = integer(random, 0, 8)
  const unitsLeft = integer(random, 0, 8)
  const hundredsRight = integer(random, 0, 9 - hundredsLeft)
  const tensRight = integer(random, 0, 9 - tensLeft)
  const unitsRight = integer(random, 0, 9 - unitsLeft)
  return [
    hundredsLeft * 100 + tensLeft * 10 + unitsLeft,
    hundredsRight * 100 + tensRight * 10 + unitsRight,
  ]
}

const noExchangeSubtraction = (random: () => number): readonly [number, number] => {
  const hundredsLeft = integer(random, 1, 9)
  const tensLeft = integer(random, 0, 9)
  const unitsLeft = integer(random, 0, 9)
  const hundredsRight = integer(random, 0, hundredsLeft)
  const tensRight = integer(random, 0, tensLeft)
  const unitsRight = integer(random, 0, unitsLeft)
  return [
    hundredsLeft * 100 + tensLeft * 10 + unitsLeft,
    hundredsRight * 100 + tensRight * 10 + unitsRight,
  ]
}

const generateInteger = (skill: Ce2Skill, tier: Ce2Tier, seed: number): Ce2Question => {
  const random = makeRandom(seed)
  if (skill === 'A1') {
    const left = integer(random, 1, 9) * 100 + integer(random, 0, 9) * 10
    const right = tier <= 2 ? integer(random, 1, 9) * 10 : integer(random, 1, 6) * 100
    return makeIntegerQuestion('A1', tier, seed, left, right, 'add', 'place-value')
  }
  if (skill === 'A2') {
    const [left, right] = noRegroupAddition(random)
    return makeIntegerQuestion('A2', tier, seed, left, right, 'add', 'direct')
  }
  if (skill === 'A3') {
    const [left, right] = pick(
      [
        [268, 7],
        [395, 20],
        [598, 5],
        [950, 70],
      ] as const,
      random,
    )
    return makeIntegerQuestion('A3', tier, seed, left, right, 'add', 'landmark')
  }
  if (skill === 'A4') {
    const left = integer(random, 120, 920)
    const right = pick([8, 9, 18, 19, 28, 29, 38, 39] as const, random)
    return makeIntegerQuestion('A4', tier, seed, left, right, 'add', 'compensation')
  }
  if (skill === 'S1') {
    const right = tier <= 2 ? integer(random, 1, 9) * 10 : integer(random, 1, 6) * 100
    const left = integer(random, Math.ceil(right / 100), 9) * 100 + integer(random, 0, 9) * 10
    return makeIntegerQuestion('S1', tier, seed, left, right, 'subtract', 'place-value')
  }
  if (skill === 'S2') {
    const [left, right] = noExchangeSubtraction(random)
    return makeIntegerQuestion('S2', tier, seed, left, right, 'subtract', 'direct')
  }
  if (skill === 'S3') {
    const [left, right] = pick(
      [
        [402, 5],
        [650, 70],
        [700, 8],
        [1_000 - 1, 90],
      ] as const,
      random,
    )
    return makeIntegerQuestion('S3', tier, seed, left, right, 'subtract', 'landmark')
  }
  if (skill === 'S4') {
    const right = pick([9, 19, 29, 39] as const, random)
    const left = integer(random, right, 999)
    return makeIntegerQuestion('S4', tier, seed, left, right, 'subtract', 'compensation')
  }
  throw new RangeError(`Skill ${skill} is not an integer-calculation skill`)
}

const generateColumn = (skill: 'A5' | 'S5', tier: Ce2Tier, seed: number): Ce2Question => {
  const random = makeRandom(seed)
  const additionExamples: ReadonlyArray<readonly [number, number]> =
    tier === 1
      ? ([
          [243, 125],
          [246, 127],
          [315, 273],
          [458, 131],
        ] as const)
      : tier === 2
        ? ([
            [286, 157],
            [372, 159],
            [468, 275],
            [587, 346],
          ] as const)
        : tier === 3
          ? ([
              [405, 596],
              [508, 297],
              [609, 284],
              [704, 398],
            ] as const)
          : ([
              [678, 459],
              [999, 999],
              [867, 578],
              [795, 689],
            ] as const)
  const subtractionExamples: ReadonlyArray<readonly [number, number]> =
    tier === 1
      ? ([
          [584, 231],
          [532, 118],
          [675, 243],
          [643, 129],
        ] as const)
      : tier === 2
        ? ([
            [532, 178],
            [741, 286],
            [653, 279],
            [824, 357],
          ] as const)
        : tier === 3
          ? ([
              [402, 185],
              [700, 358],
              [803, 476],
              [500, 267],
            ] as const)
          : ([
              [600, 247],
              [900, 458],
              [701, 586],
              [800, 679],
            ] as const)
  const examples = skill === 'A5' ? additionExamples : subtractionExamples
  const [left, right] = examples[Math.abs(seed) % examples.length] ?? pick(examples, random)
  const operation = skill === 'A5' ? 'add' : 'subtract'
  const value = operation === 'add' ? left + right : left - right
  const requiresCarry =
    operation === 'add' &&
    ((left % 10) + (right % 10) >= 10 ||
      (Math.floor(left / 10) % 10) + (Math.floor(right / 10) % 10) >= 10)
  const requiresExchange =
    operation === 'subtract' &&
    (left % 10 < right % 10 || Math.floor(left / 10) % 10 < Math.floor(right / 10) % 10)
  const mode = tier >= 3 || Math.abs(seed) % 3 === 0 ? 'autonomous' : 'guided'
  return {
    ...questionBase({
      noveltyKey: `${skill}:${left}:${right}:${mode}`,
      prompt: `ce2.${skill}.column`,
      representation: 'column-grid',
      responseMode: 'column',
      seed,
      skill,
      tier,
    }),
    family: 'column',
    left,
    mode,
    operation,
    requiresCarry,
    requiresExchange,
    right,
    solution: {
      alignment: [...alignmentFor(left, 'left'), ...alignmentFor(right, 'right')],
      type: 'column',
      value,
    },
    zeroBridge: operation === 'subtract' && String(left).includes('0'),
  }
}

const generateProblem = (skill: 'P1' | 'P2' | 'F9', tier: Ce2Tier, seed: number): Ce2Question => {
  const random = makeRandom(seed)
  if (skill === 'P1') {
    const operation = seed % 2 === 0 ? 'add' : 'subtract'
    const first = integer(random, 200, 700)
    const second = integer(random, 40, operation === 'add' ? 250 : first)
    const produced = Math.abs(seed) % 3 === 0
    const value = operation === 'add' ? first + second : first - second
    const problemChoice = (choiceOperation: 'add' | 'subtract'): Ce2Answer => ({
      intermediateResults: [],
      operation: choiceOperation,
      type: 'problem',
      value: null,
    })
    return {
      ...questionBase({
        choices: produced ? [] : choices([problemChoice('add'), problemChoice('subtract')]),
        noveltyKey: `P1:${operation}:${first}:${second}`,
        prompt: 'ce2.P1.choose-operation',
        representation: 'part-whole',
        responseMode: 'problem',
        seed,
        skill,
        tier,
      }),
      family: 'problem',
      operations: [operation],
      solution: {
        intermediateResults: [],
        operation,
        type: 'problem',
        value: produced ? value : null,
      },
      story: operation === 'add' ? 'seed-reserve-receives' : 'seed-reserve-uses',
      values: [first, second],
    }
  }
  if (skill === 'P2') {
    const initial = integer(random, 250, 600)
    const added = integer(random, 50, 250)
    const removed = integer(random, 20, initial + added)
    return {
      ...questionBase({
        noveltyKey: `P2:${initial}:${added}:${removed}`,
        prompt: 'ce2.P2.two-steps',
        representation: 'part-whole',
        responseMode: 'problem',
        seed,
        skill,
        tier,
      }),
      family: 'problem',
      operations: ['add', 'subtract'],
      solution: {
        intermediateResults: [initial + added],
        operation: null,
        type: 'problem',
        value: initial + added - removed,
      },
      story: 'seed-reserve-two-steps',
      values: [initial, added, removed],
    }
  }
  const denominator = pick([4, 5, 6, 8, 10, 12] as const, random)
  const first = integer(random, 0, Math.max(0, denominator - 2))
  const second = integer(random, 0, denominator - first)
  return {
    ...questionBase({
      noveltyKey: `F9:${first}:${second}:${denominator}`,
      prompt: 'ce2.F9.fraction-problem',
      representation: representationFor(skill, seed, 'bar'),
      responseMode: 'fraction',
      seed,
      skill,
      tier,
    }),
    family: 'problem',
    operations: ['add'],
    solution: { denominator, numerator: first + second, type: 'fraction' },
    story: 'painted-strip-additional-part',
    values: [first, second, denominator],
  }
}

const denominatorForTier = (tier: Ce2Tier, random: () => number): number => {
  const allowed =
    tier === 1
      ? [2, 3, 4]
      : tier === 2
        ? [2, 3, 4, 5, 6]
        : tier === 3
          ? [4, 6, 8, 10]
          : [5, 6, 7, 8, 9, 10, 11, 12]
  return pick(allowed, random)
}

const generateFraction = (
  skill: 'F1' | 'F2' | 'F3' | 'F7' | 'F8',
  tier: Ce2Tier,
  seed: number,
): Ce2Question => {
  const random = makeRandom(seed)
  const representation = representationFor(skill, seed, 'bar')
  if (skill === 'F1') {
    // The first LCG sample clusters for adjacent small seeds; advance once so short sessions vary.
    random()
    const denominator = denominatorForTier(tier, random)
    const correctId = `shape-${Math.abs(seed) % 3}`
    const shapeChoices = [0, 1, 2].map((index) => ({
      answer: { choiceIds: [`shape-${index}`], type: 'selection' as const },
      id: `shape-${index}`,
      label: `partition-${index}`,
    }))
    return {
      ...questionBase({
        choices: shapeChoices,
        noveltyKey: `F1:${denominator}:${correctId}:${representation}`,
        prompt: 'ce2.F1.equal-parts',
        representation,
        responseMode: Math.abs(seed) % 3 === 0 ? 'multi-select' : 'choice',
        seed,
        skill,
        tier,
      }),
      family: 'fraction',
      operands: [{ denominator, numerator: 1 }],
      partitions: [0, 1, 2].map((index) => ({
        id: `shape-${index}`,
        segmentWeights:
          `shape-${index}` === correctId
            ? Array.from({ length: denominator }, () => 3)
            : index % 2 === 0
              ? [2, 4, ...Array.from({ length: denominator - 2 }, () => 3)]
              : [1, 5, ...Array.from({ length: denominator - 2 }, () => 3)],
      })),
      solution: { choiceIds: [correctId], type: 'selection' },
      task: 'equal-parts',
    }
  }
  if (skill === 'F2') {
    const denominator = denominatorForTier(tier, random)
    const numerator = Math.abs(seed) % (denominator + 1)
    const expected = { denominator, numerator }
    const explicitPartition = tier === 4 && Math.abs(seed) % 4 === 0
    return {
      ...questionBase({
        choices:
          Math.abs(seed) % 3 !== 0
            ? fractionChoices(
                expected,
                [
                  { denominator, numerator: Math.max(0, numerator - 1) },
                  { denominator, numerator: Math.min(denominator, numerator + 1) },
                  { denominator: Math.min(12, denominator + 1), numerator },
                ],
                random,
              )
            : [],
        noveltyKey: `F2:${numerator}:${denominator}:${representation}`,
        prompt: explicitPartition ? 'ce2.F2.write-required-partition' : 'ce2.F2.read-represent',
        representation,
        requiredDenominator: explicitPartition ? denominator : null,
        responseMode: Math.abs(seed) % 3 === 0 ? 'fraction' : 'choice',
        seed,
        skill,
        tier,
      }),
      family: 'fraction',
      operands: [expected],
      partitions: [
        { id: 'shown-unit', segmentWeights: Array.from({ length: denominator }, () => 1) },
      ],
      solution: { denominator, numerator, type: 'fraction' },
      task: 'represent',
    }
  }
  if (skill === 'F3') {
    const bases = [
      [
        { denominator: 2, numerator: 1 },
        { denominator: 4, numerator: 2 },
      ],
      [
        { denominator: 3, numerator: 1 },
        { denominator: 6, numerator: 2 },
      ],
      [
        { denominator: 4, numerator: 3 },
        { denominator: 8, numerator: 6 },
      ],
      [
        { denominator: 6, numerator: 5 },
        { denominator: 12, numerator: 10 },
      ],
    ] as const
    const [shown, expected] = pick(bases, random)
    return {
      ...questionBase({
        choices:
          Math.abs(seed) % 3 === 0
            ? []
            : fractionChoices(
                expected,
                [
                  { denominator: expected.denominator, numerator: expected.numerator - 1 },
                  { denominator: expected.denominator, numerator: expected.numerator + 1 },
                  { denominator: shown.denominator, numerator: Math.max(0, shown.numerator - 1) },
                ],
                random,
              ),
        noveltyKey: `F3:${rationalKey(shown)}:${rationalKey(expected)}:${representation}`,
        prompt: 'ce2.F3.find-equivalent',
        representation,
        responseMode: Math.abs(seed) % 3 === 0 ? 'fraction' : 'choice',
        seed,
        skill,
        tier,
      }),
      family: 'fraction',
      operands: [shown],
      partitions: [
        {
          id: 'shown-partition',
          segmentWeights: Array.from({ length: shown.denominator }, () => 1),
        },
        {
          id: 'comparison-partition',
          segmentWeights: Array.from({ length: expected.denominator }, () => 1),
        },
      ],
      solution: { ...expected, type: 'fraction' },
      task: 'equivalence',
    }
  }
  if (skill === 'F7') {
    const denominator = denominatorForTier(tier, random)
    const operation = seed % 2 === 0 ? 'add' : 'subtract'
    const first = integer(random, operation === 'add' ? 0 : 1, denominator)
    const second = integer(random, 0, operation === 'add' ? denominator - first : first)
    const numerator = operation === 'add' ? first + second : first - second
    return {
      ...questionBase({
        noveltyKey: `F7:${first}:${operation}:${second}:${denominator}:${representation}`,
        prompt: `ce2.F7.${operation}`,
        representation,
        responseMode: 'fraction',
        seed,
        skill,
        tier,
      }),
      family: 'fraction',
      operands: [
        { denominator, numerator: first },
        { denominator, numerator: second },
      ],
      partitions: [
        { id: 'common-partition', segmentWeights: Array.from({ length: denominator }, () => 1) },
      ],
      solution: { denominator, numerator, type: 'fraction' },
      task: operation,
    }
  }
  const pairs = [
    [{ denominator: 3, numerator: 1 }, { denominator: 6, numerator: 1 }, 'add'],
    [{ denominator: 4, numerator: 3 }, { denominator: 8, numerator: 1 }, 'subtract'],
    [{ denominator: 2, numerator: 1 }, { denominator: 6, numerator: 2 }, 'add'],
    [{ denominator: 6, numerator: 5 }, { denominator: 12, numerator: 3 }, 'subtract'],
  ] as const
  const [left, right, operation] = pick(pairs, random)
  const result = operation === 'add' ? addRational(left, right) : subtractRational(left, right)
  return {
    ...questionBase({
      noveltyKey: `F8:${rationalKey(left)}:${operation}:${rationalKey(right)}:${representation}`,
      prompt: `ce2.F8.${operation}`,
      representation,
      responseMode: 'fraction',
      seed,
      skill,
      tier,
    }),
    family: 'fraction',
    operands: [left, right],
    partitions: [
      {
        id: 'left-partition',
        segmentWeights: Array.from({ length: left.denominator }, () => 1),
      },
      {
        id: 'common-partition',
        segmentWeights: Array.from(
          { length: Math.max(left.denominator, right.denominator) },
          () => 1,
        ),
      },
    ],
    solution: { ...result, type: 'fraction' },
    task: operation,
  }
}

const generateComparison = (tier: Ce2Tier, seed: number): Ce2Question => {
  const random = makeRandom(seed)
  if (Math.abs(seed) % 3 === 0) {
    const orderedValues = [
      { denominator: 4, numerator: 1 },
      { denominator: 2, numerator: 1 },
      { denominator: 4, numerator: 3 },
    ] as const
    const rotation = 1 + (Math.floor(Math.abs(seed) / 3) % (orderedValues.length - 1))
    const shownValues = [...orderedValues.slice(rotation), ...orderedValues.slice(0, rotation)]
    const items = shownValues.map((value, index) => ({ id: `fraction-${index}`, value }))
    const orderedIds = [...items]
      .sort((left, right) => compareRational(left.value, right.value))
      .map(({ id }) => id)
    return {
      ...questionBase({
        noveltyKey: `F4:order:${items.map(({ value }) => rationalKey(value)).join(':')}`,
        prompt: 'ce2.F4.order',
        representation: representationFor('F4', seed, 'bar'),
        responseMode: 'ordering',
        seed,
        skill: 'F4',
        tier,
      }),
      family: 'ordering',
      items,
      solution: { orderedIds, type: 'ordering' },
    }
  }
  const examples = [
    [
      { denominator: 7, numerator: 2 },
      { denominator: 7, numerator: 5 },
    ],
    [
      { denominator: 8, numerator: 3 },
      { denominator: 4, numerator: 3 },
    ],
    [
      { denominator: 3, numerator: 2 },
      { denominator: 6, numerator: 5 },
    ],
    [
      { denominator: 2, numerator: 1 },
      { denominator: 4, numerator: 2 },
    ],
  ] as const
  const [left, right] = pick(examples, random)
  const comparison = compareRational(left, right)
  const relation = comparison < 0 ? 'less' : comparison > 0 ? 'greater' : 'equal'
  const representation = representationFor('F4', seed, 'bar')
  return {
    ...questionBase({
      noveltyKey: `F4:${rationalKey(left)}:${rationalKey(right)}:${representation}`,
      prompt: 'ce2.F4.compare',
      representation,
      responseMode: 'comparison',
      seed,
      skill: 'F4',
      tier,
    }),
    family: 'comparison',
    left,
    right,
    solution: { relation, type: 'comparison' },
  }
}

const generateNumberLine = (tier: Ce2Tier, seed: number): Ce2Question => {
  const random = makeRandom(seed)
  const denominator = denominatorForTier(tier, random)
  const numerator = integer(random, 0, denominator)
  return {
    ...questionBase({
      noveltyKey: `F5:${numerator}:${denominator}`,
      prompt: 'ce2.F5.place-on-line',
      representation: 'graduated-line',
      responseMode: 'number-line',
      seed,
      skill: 'F5',
      tier,
    }),
    denominator,
    family: 'number-line',
    solution: { tick: numerator, type: 'number-line' },
    target: { denominator, numerator },
    tickCount: denominator,
  }
}

const generateLength = (tier: Ce2Tier, seed: number): Ce2Question => {
  const random = makeRandom(seed)
  const denominator = denominatorForTier(tier, random)
  const numerator = integer(random, 0, denominator - 1)
  const wholeUnits = tier <= 2 ? 1 : integer(random, 0, 2)
  return {
    ...questionBase({
      noveltyKey: `F6:${wholeUnits}:${numerator}:${denominator}`,
      prompt: 'ce2.F6.measure-relative-unit',
      representation: 'unit-strip',
      responseMode: 'length',
      seed,
      skill: 'F6',
      tier,
    }),
    family: 'length',
    fraction: { denominator, numerator },
    solution: { denominator, numerator, type: 'length', whole: wholeUnits },
    wholeUnits,
  }
}

export type GenerateCe2QuestionInput = Readonly<{
  seed: number
  skill: Ce2Skill
  tier: Ce2Tier
}>

const generateQuestion = ({ seed, skill, tier }: GenerateCe2QuestionInput): Ce2Question => {
  if (skill === 'N1') return generatePlaceValue(tier, seed)
  if (['A1', 'A2', 'A3', 'A4', 'S1', 'S2', 'S3', 'S4'].includes(skill)) {
    return generateInteger(skill, tier, seed)
  }
  if (skill === 'A5' || skill === 'S5') return generateColumn(skill, tier, seed)
  if (skill === 'P1' || skill === 'P2' || skill === 'F9') {
    return generateProblem(skill, tier, seed)
  }
  if (skill === 'F1' || skill === 'F2' || skill === 'F3' || skill === 'F7' || skill === 'F8') {
    return generateFraction(skill, tier, seed)
  }
  if (skill === 'F4') return generateComparison(tier, seed)
  if (skill === 'F5') return generateNumberLine(tier, seed)
  if (skill === 'F6') return generateLength(tier, seed)
  throw new RangeError(`Unsupported CE2 skill: ${skill}`)
}

const generateLegacyF1Question = (tier: Ce2Tier, seed: number): Ce2Question => {
  const representation = representationFor('F1', seed, 'bar')
  const correctId = `shape-${Math.abs(seed) % 3}`
  const shapeChoices = [0, 1, 2].map((index) => ({
    answer: { choiceIds: [`shape-${index}`], type: 'selection' as const },
    id: `shape-${index}`,
    label: `partition-${index}`,
  }))
  return {
    ...questionBase({
      choices: shapeChoices,
      noveltyKey: `F1:${correctId}:${representation}`,
      prompt: 'ce2.F1.equal-parts',
      representation,
      responseMode: Math.abs(seed) % 3 === 0 ? 'multi-select' : 'choice',
      seed,
      skill: 'F1',
      tier,
    }),
    family: 'fraction',
    operands: [{ denominator: 4, numerator: 1 }],
    partitions: [0, 1, 2].map((index) => ({
      id: `shape-${index}`,
      segmentWeights:
        `shape-${index}` === correctId
          ? [3, 3, 3, 3]
          : index % 2 === 0
            ? [2, 4, 3, 3]
            : [1, 5, 2, 4],
    })),
    solution: { choiceIds: [correctId], type: 'selection' },
    task: 'equal-parts',
  }
}

const stableValue = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableValue(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const validateQuestion = (question: Ce2Question): boolean => {
  try {
    const identity = /^ce2-([a-z]\d)-p([1-4])-(-?\d+)$/.exec(question.id)
    if (identity === null) return false
    const [, encodedSkill, encodedTier, encodedSeed] = identity
    const skill = encodedSkill?.toUpperCase()
    if (
      skill === undefined ||
      ![...arithmeticSkills, ...fractionSkills].includes(skill as Ce2Skill)
    ) {
      return false
    }
    const tier = Number(encodedTier) as Ce2Tier
    const seed = Number(encodedSeed)
    if (!Number.isSafeInteger(seed)) return false
    const expected = stableValue(generateQuestion({ seed, skill: skill as Ce2Skill, tier }))
    const received = stableValue(question)
    if (received === expected) return true
    return skill === 'F1' && received === stableValue(generateLegacyF1Question(tier, seed))
  } catch {
    return false
  }
}

const canonicalForAnswer = (answer: Ce2Answer): string | null => {
  if (answer.type === 'fraction') return rationalKey(answer)
  if (answer.type === 'length') {
    return rationalKey({
      denominator: answer.denominator,
      numerator: answer.whole * answer.denominator + answer.numerator,
    })
  }
  if (answer.type === 'integer' || answer.type === 'column') return String(answer.value)
  if (answer.type === 'problem') return answer.value === null ? null : String(answer.value)
  return null
}

const sameAlignment = (
  first: Extract<Ce2Answer, { type: 'column' }>['alignment'],
  second: Extract<Ce2Answer, { type: 'column' }>['alignment'],
): boolean => {
  const key = (entry: (typeof first)[number]): string =>
    `${entry.operand}:${entry.column}:${entry.digit}`
  return [...first].map(key).sort().join('|') === [...second].map(key).sort().join('|')
}

const columnNames = ['units', 'tens', 'hundreds', 'thousands'] as const

const digitAt = (value: number, position: number): number => Math.floor(value / 10 ** position) % 10

const expectedColumnSteps = (question: Ce2Question): ReadonlyArray<Ce2ColumnStep> => {
  if (question.family !== 'column') return []
  if (question.operation === 'add') {
    const steps: Ce2ColumnStep[] = []
    let carry = 0
    for (let position = 0; position < 3 || carry > 0; position += 1) {
      const incoming = carry
      const total = digitAt(question.left, position) + digitAt(question.right, position) + incoming
      carry = Math.floor(total / 10)
      const column = columnNames[position]
      if (column === undefined) break
      steps.push({
        column,
        exchangedFrom: null,
        incoming,
        operation: 'add',
        outgoing: carry,
        resultDigit: total % 10,
      })
    }
    return steps
  }

  const steps: Ce2ColumnStep[] = []
  let givenToLowerColumn = 0
  for (let position = 0; position < 3; position += 1) {
    const column = columnNames[position]
    if (column === undefined) break
    const available = digitAt(question.left, position) - givenToLowerColumn
    const subtrahend = digitAt(question.right, position)
    const needsExchange = available < subtrahend
    const incoming = needsExchange ? 10 : 0
    const exchangedFrom = needsExchange ? (columnNames[position + 1] ?? null) : null
    steps.push({
      column,
      exchangedFrom,
      incoming,
      operation: 'subtract',
      outgoing: givenToLowerColumn,
      resultDigit: available + incoming - subtrahend,
    })
    givenToLowerColumn = needsExchange ? 1 : 0
  }
  return steps
}

const sameColumnSteps = (
  first: ReadonlyArray<Ce2ColumnStep>,
  second: ReadonlyArray<Ce2ColumnStep>,
): boolean => stableValue(first) === stableValue(second)

const expectedAnswer = (question: Ce2Question): Ce2Answer =>
  generateQuestion({
    seed: question.generationSeed,
    skill: question.skill,
    tier: question.tier,
  }).solution

const incorrectEvaluation = (
  reason: Ce2Evaluation['reason'],
  canonicalValue: string | null,
): Ce2Evaluation => ({
  canonicalValue,
  dimensions: {
    alignment: null,
    format: false,
    intermediate: null,
    model: null,
    ordering: null,
    procedure: null,
    value: false,
  },
  reason,
  status: 'incorrect',
})

export type EvaluateCe2AnswerInput = Readonly<{
  answer: Ce2Answer
  columnSteps?: ReadonlyArray<Ce2ColumnStep>
  question: Ce2Question
}>

const evaluate = ({
  answer,
  columnSteps = [],
  question,
}: EvaluateCe2AnswerInput): Ce2Evaluation => {
  const canonicalValue = canonicalForAnswer(answer)
  if (!validateQuestion(question)) return incorrectEvaluation('invalid-question', canonicalValue)
  const expected = expectedAnswer(question)
  if (answer.type !== expected.type) return incorrectEvaluation('wrong-answer-kind', canonicalValue)

  let value = false
  let alignment: boolean | null = null
  let intermediate: boolean | null = null
  let model: boolean | null = null
  let ordering: boolean | null = null
  let format = true
  if (answer.type === 'integer' && expected.type === 'integer')
    value = answer.value === expected.value
  else if (answer.type === 'place-value' && expected.type === 'place-value') {
    value =
      answer.hundreds === expected.hundreds &&
      answer.tens === expected.tens &&
      answer.units === expected.units
  } else if (answer.type === 'fraction' && expected.type === 'fraction') {
    value = compareRational(answer, expected) === 0
    format =
      question.requiredDenominator === null || answer.denominator === question.requiredDenominator
  } else if (answer.type === 'comparison' && expected.type === 'comparison') {
    value = answer.relation === expected.relation
  } else if (answer.type === 'selection' && expected.type === 'selection') {
    value =
      [...new Set(answer.choiceIds)].sort().join('|') ===
      [...new Set(expected.choiceIds)].sort().join('|')
  } else if (answer.type === 'operation' && expected.type === 'operation') {
    value = answer.operation === expected.operation
  } else if (answer.type === 'number-line' && expected.type === 'number-line') {
    value = answer.tick === expected.tick
  } else if (answer.type === 'length' && expected.type === 'length') {
    value =
      compareRational(
        {
          denominator: answer.denominator,
          numerator: answer.whole * answer.denominator + answer.numerator,
        },
        {
          denominator: expected.denominator,
          numerator: expected.whole * expected.denominator + expected.numerator,
        },
      ) === 0
  } else if (answer.type === 'column' && expected.type === 'column') {
    value = answer.value === expected.value
    alignment =
      question.family === 'column' && question.mode === 'autonomous' && answer.alignment.length > 0
        ? sameAlignment(answer.alignment, expected.alignment)
        : question.family === 'column' && question.mode === 'autonomous'
          ? null
          : true
  } else if (answer.type === 'ordering' && expected.type === 'ordering') {
    ordering =
      [...answer.orderedIds].join('|') === [...expected.orderedIds].join('|') &&
      new Set(answer.orderedIds).size === answer.orderedIds.length
    value = ordering
  } else if (answer.type === 'problem' && expected.type === 'problem') {
    model = expected.operation === null || answer.operation === expected.operation
    intermediate =
      answer.intermediateResults.length === expected.intermediateResults.length &&
      answer.intermediateResults.every(
        (result, index) => result === expected.intermediateResults[index],
      )
    const finalValue = expected.value === null || answer.value === expected.value
    value = model && intermediate && finalValue
  }

  const procedure =
    question.family !== 'column' || (!question.requiresCarry && !question.requiresExchange)
      ? null
      : sameColumnSteps(columnSteps, expectedColumnSteps(question))
  if (value && !format) {
    return {
      canonicalValue,
      dimensions: { alignment, format, intermediate, model, ordering, procedure, value },
      reason: 'equivalent-needs-format',
      status: 'equivalent-needs-format',
    }
  }
  if (value && alignment === false) {
    return {
      canonicalValue,
      dimensions: { alignment, format, intermediate, model, ordering, procedure, value },
      reason: 'wrong-alignment',
      status: 'incorrect',
    }
  }
  return {
    canonicalValue,
    dimensions: { alignment, format, intermediate, model, ordering, procedure, value },
    reason: value ? 'correct' : 'wrong-value',
    status: value ? 'correct' : 'incorrect',
  }
}

const learningDayKey = (at: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const initialDraft = ({
  now,
  question,
}: Readonly<{ now: Date; question: Ce2Question }>): Ce2Draft => ({
  activeColumn: question.family === 'column' ? 'units' : null,
  activeElapsedMs: 0,
  answer: null,
  borrows: {},
  carries: {},
  columnEntries: {},
  freeMode: false,
  helpOpened: false,
  orderedIds: [],
  questionId: question.id,
  resultRevealed: false,
  schemaVersion: 'ce2-draft/v1',
  selectedPartIds: [],
  switchedToFree: false,
  updatedAt: now,
})

export type AnswerCe2Input = Readonly<{
  answer: Ce2Answer
  answeredAt: Date
  assistance: Ce2Assistance
  columnSteps?: ReadonlyArray<Ce2ColumnStep>
  eventId: string
  session: Ce2Session
}>

export type Ce2AnswerResult = Readonly<{
  attempt: Ce2Attempt
  correct: boolean
  evaluation: Ce2Evaluation
  session: Ce2Session
}>

const answer = ({
  answer: submitted,
  answeredAt,
  assistance,
  columnSteps = [],
  eventId,
  session,
}: AnswerCe2Input): Ce2AnswerResult => {
  const question = session.questions[session.currentIndex]
  if (question === undefined) throw new RangeError('The CE2 session is already complete')
  const evaluation = evaluate({ answer: submitted, columnSteps, question })
  const latencyMs = Math.max(
    0,
    session.draft?.activeElapsedMs ??
      answeredAt.getTime() - session.currentQuestionStartedAt.getTime(),
  )
  const attempt: Ce2Attempt = {
    answer: submitted,
    answeredAt,
    assistance,
    columnSteps: [...columnSteps],
    evaluation,
    eventId,
    latencyMs,
    learningDayKey: learningDayKey(answeredAt, session.timeZone),
    question,
    questionCount: session.questions.length,
    schemaVersion: 'ce2-attempt/v1',
    sequence: session.currentIndex,
    sessionId: session.id,
    sessionKind: session.kind,
  }
  const nextIndex = session.currentIndex + 1
  const nextQuestion = session.questions[nextIndex]
  return {
    attempt,
    correct: evaluation.status === 'correct',
    evaluation,
    session: {
      ...session,
      currentIndex: nextIndex,
      currentQuestionStartedAt: answeredAt,
      draft:
        nextQuestion === undefined
          ? null
          : initialDraft({ now: answeredAt, question: nextQuestion }),
      lastResult: { answer: submitted, evaluation, questionId: question.id },
    },
  }
}

const EMPTY_MASTERY: Ce2SkillMastery = {
  alignmentAutonomous: false,
  autonomousSuccessCount: 0,
  correctCount: 0,
  lastPracticedAt: null,
  novelSuccessKeys: [],
  procedureEvidence: [],
  producedResponseCount: 0,
  recentAutonomousResults: [],
  representations: [],
  state: 'unseen',
  successfulDayKeys: [],
}

const emptySnapshot = (): Ce2Snapshot => ({
  algorithmVersion: CE2_MASTERY_ALGORITHM_VERSION,
  enabledModules: [],
  mastery: {},
  processedEventIds: [],
  recentPrimaryFamilies: [],
})

const isAssisted = (assistance: Ce2Assistance): boolean =>
  assistance.guided ||
  assistance.helpOpened ||
  assistance.representationHints > 0 ||
  assistance.resultRevealed ||
  assistance.switchedToFree

const isProducedResponse = (question: Ce2Question): boolean =>
  question.responseMode === 'problem'
    ? question.choices.length === 0
    : !['choice', 'operation'].includes(question.responseMode)

const fractionNeedsTwoRepresentations = (skill: Ce2Skill): boolean =>
  ['F1', 'F2', 'F3', 'F4', 'F7', 'F8', 'F9'].includes(skill)

const deriveMasteryState = (
  mastery: Omit<Ce2SkillMastery, 'state'>,
  skill: Ce2Skill,
): Ce2SkillMastery['state'] => {
  const recent = mastery.recentAutonomousResults.slice(-10)
  const accuracy = recent.length === 0 ? 0 : recent.filter(Boolean).length / recent.length
  const representationReady =
    !fractionNeedsTwoRepresentations(skill) || mastery.representations.length >= 2
  const columnReady =
    skill !== 'A5' && skill !== 'S5'
      ? true
      : mastery.alignmentAutonomous &&
        mastery.procedureEvidence.includes(skill === 'A5' ? 'carry' : 'exchange')
  const fluent =
    mastery.autonomousSuccessCount >= 6 &&
    mastery.successfulDayKeys.length >= 3 &&
    mastery.novelSuccessKeys.length >= 3 &&
    recent.length >= 6 &&
    accuracy >= 0.8 &&
    mastery.producedResponseCount > 0 &&
    representationReady &&
    columnReady
  if (fluent) return 'fluent'
  if (mastery.correctCount >= 3 && mastery.successfulDayKeys.length >= 2) return 'familiar'
  if (mastery.correctCount > 0 || recent.length > 0) return 'learning'
  return 'unseen'
}

const reduceAttempt = (current: Ce2SkillMastery, attempt: Ce2Attempt): Ce2SkillMastery => {
  const evaluation = evaluate({
    answer: attempt.answer,
    columnSteps: attempt.columnSteps,
    question: attempt.question,
  })
  const correct = evaluation.status === 'correct' || evaluation.status === 'equivalent-needs-format'
  const autonomous =
    attempt.sessionKind !== 'discovery' &&
    !(attempt.question.family === 'column' && attempt.question.mode === 'guided') &&
    !isAssisted(attempt.assistance)
  const autonomousSuccess = autonomous && correct
  const recentAutonomousResults = autonomous
    ? [...current.recentAutonomousResults, correct].slice(-10)
    : current.recentAutonomousResults
  const successfulDayKeys = autonomousSuccess
    ? [...new Set([...current.successfulDayKeys, attempt.learningDayKey])].sort()
    : current.successfulDayKeys
  const novelSuccessKeys = autonomousSuccess
    ? [...new Set([...current.novelSuccessKeys, attempt.question.noveltyKey])]
    : current.novelSuccessKeys
  const representations = autonomousSuccess
    ? [...new Set([...current.representations, attempt.question.representation])]
    : current.representations
  const procedureEvidence = [...current.procedureEvidence]
  if (
    autonomousSuccess &&
    attempt.question.family === 'column' &&
    evaluation.dimensions.procedure === true
  ) {
    const evidence = attempt.question.operation === 'add' ? 'carry' : 'exchange'
    if (!procedureEvidence.includes(evidence)) procedureEvidence.push(evidence)
  }
  const nextWithoutState = {
    alignmentAutonomous:
      current.alignmentAutonomous ||
      (autonomousSuccess &&
        attempt.question.family === 'column' &&
        attempt.question.mode === 'autonomous' &&
        evaluation.dimensions.alignment === true),
    autonomousSuccessCount: current.autonomousSuccessCount + (autonomousSuccess ? 1 : 0),
    correctCount: current.correctCount + (correct ? 1 : 0),
    lastPracticedAt: attempt.answeredAt,
    novelSuccessKeys,
    procedureEvidence,
    producedResponseCount:
      current.producedResponseCount +
      (autonomousSuccess && isProducedResponse(attempt.question) ? 1 : 0),
    recentAutonomousResults,
    representations,
    successfulDayKeys,
  }
  const derivedState = deriveMasteryState(nextWithoutState, attempt.question.skill)
  const baselinePassed =
    attempt.question.skill === 'N1' && autonomousSuccess && isProducedResponse(attempt.question)
  return {
    ...nextWithoutState,
    state:
      baselinePassed && (derivedState === 'unseen' || derivedState === 'learning')
        ? 'familiar'
        : derivedState,
  }
}

export type ReduceCe2AttemptsInput = Readonly<{
  attempts: ReadonlyArray<Ce2Attempt>
  snapshot: Ce2Snapshot
}>

const reduce = ({ attempts, snapshot }: ReduceCe2AttemptsInput): Ce2Snapshot => {
  const processed = new Set(snapshot.processedEventIds)
  const mastery = { ...snapshot.mastery }
  for (const attempt of attempts) {
    if (processed.has(attempt.eventId)) continue
    processed.add(attempt.eventId)
    const key = masteryKey(attempt.question.skill, attempt.question.tier)
    mastery[key] = reduceAttempt(mastery[key] ?? EMPTY_MASTERY, attempt)
  }
  return { ...snapshot, mastery, processedEventIds: [...processed] }
}

const activateModule = (snapshot: Ce2Snapshot, module: Ce2Module): Ce2Snapshot => ({
  ...snapshot,
  enabledModules: [...new Set([...snapshot.enabledModules, module])],
})

const emptyPreferences = (now: Date): Ce2Preferences => ({
  enabledModules: [],
  lastDailyFamily: null,
  schemaVersion: 'ce2-preferences/v1',
  updatedAt: now,
})

const applyPreferenceUpdate = ({
  preferences,
  update,
}: Readonly<{
  preferences: Ce2Preferences
  update: Ce2PreferenceUpdate
}>): Ce2Preferences => {
  const updateIsNewest = update.updatedAt.getTime() >= preferences.updatedAt.getTime()
  return {
    enabledModules: [...new Set([...preferences.enabledModules, ...update.enabledModules])],
    lastDailyFamily: updateIsNewest ? update.lastDailyFamily : preferences.lastDailyFamily,
    schemaVersion: 'ce2-preferences/v1',
    updatedAt: updateIsNewest ? update.updatedAt : preferences.updatedAt,
  }
}

const mergePreferences = (preferences: ReadonlyArray<Ce2Preferences>): Ce2Preferences => {
  if (preferences.length === 0) return emptyPreferences(new Date(0))
  const newest = [...preferences].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  )[0]
  if (newest === undefined) return emptyPreferences(new Date(0))
  return {
    ...newest,
    enabledModules: [...new Set(preferences.flatMap(({ enabledModules }) => enabledModules))],
  }
}

export type ScheduleCe2DailyInput = Readonly<{
  enabledFamilies: ReadonlyArray<Ce2DailyFamily>
  now: Date
  questionCount?: number
  seed: number
  snapshot: Ce2Snapshot
}>

const scheduleDaily = ({
  enabledFamilies,
  now,
  questionCount,
  seed,
  snapshot,
}: ScheduleCe2DailyInput): Ce2DailyPlan => {
  const enabled = [...new Set(enabledFamilies)]
  if (enabled.length === 0) throw new RangeError('At least one daily family must be enabled')
  const recent = snapshot.recentPrimaryFamilies
  const recency = (family: Ce2DailyFamily): number => recent.lastIndexOf(family)
  const oldestIndex = Math.min(...enabled.map(recency))
  const candidates = enabled.filter((family) => recency(family) === oldestIndex)
  const primaryFamily = candidates[Math.abs(seed) % candidates.length]
  if (primaryFamily === undefined) throw new Error('Expected a primary daily family')
  const count = Math.max(5, Math.min(8, Math.floor(questionCount ?? 8)))
  const reminderFamilies = enabled
    .filter((family) => family !== primaryFamily)
    .sort((left, right) => recency(left) - recency(right))
    .slice(0, 2)
  return {
    contentVersion: CE2_CONTENT_VERSION,
    createdAt: now,
    enabledFamilies: enabled,
    id: `ce2-plan-${now.toISOString()}-${seed >>> 0}`,
    primaryFamily,
    questionCount: count,
    reminderFamilies,
    schemaVersion: 'ce2-daily-plan/v1',
    seed,
  }
}

const recordDailyPlan = ({
  plan,
  snapshot,
}: Readonly<{ plan: Ce2DailyPlan; snapshot: Ce2Snapshot }>): Ce2Snapshot => ({
  ...snapshot,
  recentPrimaryFamilies: [...snapshot.recentPrimaryFamilies, plan.primaryFamily].slice(-12),
})

const availableSkills = (module: Ce2Module, snapshot: Ce2Snapshot): ReadonlyArray<Ce2Skill> => {
  const skills = module === 'arithmetic' ? arithmeticSkills : fractionSkills
  return skills.filter((skill) =>
    (skillPrerequisites[skill] ?? []).every((prerequisite) =>
      ([1, 2, 3, 4] as const).some(
        (tier) =>
          snapshot.mastery[masteryKey(prerequisite, tier)]?.state === 'familiar' ||
          snapshot.mastery[masteryKey(prerequisite, tier)]?.state === 'fluent',
      ),
    ),
  )
}

const chooseSkill = (module: Ce2Module, snapshot: Ce2Snapshot): Ce2Skill => {
  const available = availableSkills(module, snapshot)
  const skills: ReadonlyArray<Ce2Skill> =
    available.length > 0 ? available : module === 'arithmetic' ? ['N1'] : ['F1']
  return (
    skills.find((skill) =>
      ([1, 2, 3, 4] as const).every(
        (tier) => snapshot.mastery[masteryKey(skill, tier)] === undefined,
      ),
    ) ??
    skills.find((skill) =>
      ([1, 2, 3, 4] as const).some(
        (tier) => (snapshot.mastery[masteryKey(skill, tier)]?.state ?? 'unseen') !== 'fluent',
      ),
    ) ??
    skills[0] ??
    (module === 'arithmetic' ? 'N1' : 'F1')
  )
}

const chooseTier = (skill: Ce2Skill, snapshot: Ce2Snapshot): Ce2Tier =>
  ([1, 2, 3, 4] as const).find((tier) => {
    const state = snapshot.mastery[masteryKey(skill, tier)]?.state ?? 'unseen'
    return state === 'unseen' || state === 'learning'
  }) ??
  ([1, 2, 3, 4] as const).find(
    (tier) => snapshot.mastery[masteryKey(skill, tier)]?.state !== 'fluent',
  ) ??
  4

type SkillTier = Readonly<{ skill: Ce2Skill; tier: Ce2Tier }>

const knownSkillTiers = (module: Ce2Module, snapshot: Ce2Snapshot): ReadonlyArray<SkillTier> => {
  const skills = module === 'arithmetic' ? arithmeticSkills : fractionSkills
  return skills
    .flatMap((skill) =>
      ([1, 2, 3, 4] as const).flatMap((tier): ReadonlyArray<SkillTier> =>
        snapshot.mastery[masteryKey(skill, tier)] === undefined ? [] : [{ skill, tier }],
      ),
    )
    .sort((left, right) => {
      const leftMastery = snapshot.mastery[masteryKey(left.skill, left.tier)]
      const rightMastery = snapshot.mastery[masteryKey(right.skill, right.tier)]
      const stateRank = { familiar: 1, fluent: 2, learning: 0, unseen: 0 } as const
      const stateDifference =
        stateRank[leftMastery?.state ?? 'unseen'] - stateRank[rightMastery?.state ?? 'unseen']
      if (stateDifference !== 0) return stateDifference
      return (
        (leftMastery?.lastPracticedAt?.getTime() ?? 0) -
        (rightMastery?.lastPracticedAt?.getTime() ?? 0)
      )
    })
}

export type CreateCe2SessionInput = Readonly<{
  kind: 'daily-watering' | 'extra-practice' | 'discovery'
  module: Ce2Module
  now: Date
  questionCount?: number
  seed: number
  skill?: Ce2Skill
  snapshot: Ce2Snapshot
  timeZone?: string
}>

const createSession = ({
  kind,
  module,
  now,
  questionCount,
  seed,
  skill: requestedSkill,
  snapshot,
  timeZone = 'UTC',
}: CreateCe2SessionInput): Ce2Session => {
  const count = kind === 'discovery' ? 5 : Math.max(5, Math.min(8, Math.floor(questionCount ?? 8)))
  const skill = requestedSkill ?? chooseSkill(module, snapshot)
  if (moduleForSkill(skill) !== module) throw new RangeError(`Skill ${skill} is not in ${module}`)
  const tier = chooseTier(skill, snapshot)
  const knownPrimary = knownSkillTiers(module, snapshot)
  const frontierIsNew = !knownPrimary.some((entry) => entry.skill === skill && entry.tier === tier)
  const otherModule: Ce2Module = module === 'arithmetic' ? 'fractions' : 'arithmetic'
  const knownReminders = knownSkillTiers(otherModule, snapshot)
  const reminderCount =
    kind === 'daily-watering' &&
    skill !== 'A5' &&
    skill !== 'S5' &&
    snapshot.enabledModules.includes(otherModule)
      ? Math.min(2, knownReminders.length)
      : 0
  const mainCount = count - reminderCount
  const mainPlan: SkillTier[] = []
  if (kind === 'discovery' || kind === 'extra-practice' || knownPrimary.length === 0) {
    for (let index = 0; index < mainCount; index += 1) mainPlan.push({ skill, tier })
  } else {
    const newCount = frontierIsNew ? Math.min(2, mainCount) : 0
    for (let index = 0; index < newCount; index += 1) mainPlan.push({ skill, tier })
    const reviews = knownPrimary.length > 0 ? knownPrimary : [{ skill, tier }]
    while (mainPlan.length < mainCount) {
      const review = reviews[(mainPlan.length - newCount) % reviews.length]
      if (review !== undefined) mainPlan.push(review)
    }
  }
  const questions: Ce2Question[] = mainPlan.map((entry, index) =>
    generateQuestion({ seed: seed + index * 7_919, skill: entry.skill, tier: entry.tier }),
  )
  for (let index = 0; index < reminderCount; index += 1) {
    const reminder = knownReminders[index % knownReminders.length]
    if (reminder === undefined) break
    questions.push(
      generateQuestion({
        seed: seed + (mainCount + index) * 7_919,
        skill: reminder.skill,
        tier: reminder.tier,
      }),
    )
  }
  const firstQuestion = questions[0]
  if (firstQuestion === undefined) throw new Error('CE2 sessions require at least one question')
  return {
    createdAt: now,
    currentIndex: 0,
    currentQuestionStartedAt: now,
    draft: initialDraft({ now, question: firstQuestion }),
    id: `ce2-session-${now.toISOString()}-${seed >>> 0}`,
    kind,
    lastResult: null,
    primaryModule: module,
    questions,
    schemaVersion: 'ce2-session/v1',
    seed,
    timeZone,
  }
}

export const Ce2Engine = {
  activateModule,
  answer,
  applyPreferenceUpdate,
  arithmeticSkills,
  compareRational,
  createSession,
  emptyPreferences,
  emptySnapshot,
  evaluate,
  expectedColumnSteps,
  fractionSkills,
  generateQuestion,
  initialDraft,
  masteryKey,
  mergePreferences,
  normalizeRational,
  recordDailyPlan,
  reduce,
  scheduleDaily,
  skillPrerequisites,
  validateQuestion,
} as const

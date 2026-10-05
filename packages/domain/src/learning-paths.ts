import {
  compareFractions,
  defaultLearningPathSettings,
  equalOptionIndexes,
  expectedAnswer,
  fractionOperationResult,
  isExerciseAnswerCorrect,
  isProductionExercise,
  MAX_WHOLE_NUMBER,
  skillForKey,
  type Exercise,
  type Fraction,
  type FractionPickExercise,
  type LearningPathSettings,
  type PathId,
  type PracticeAnswer,
  type SkillId,
} from './exercises.js'

type MasteryState = 'familiar' | 'fluent' | 'learning' | 'unseen'
type FactStates = Readonly<Record<string, Readonly<{ state: MasteryState }> | undefined>>

/** Interaction families: a daily watering never mixes more than two of them. */
export type InteractionFamily = 'column' | 'fractions' | 'numbers'

type LevelGate = 'all' | 'familiar' | 'seen'

type SkillDefinition = Readonly<{
  family: InteractionFamily
  gate: LevelGate
  id: SkillId
  keys: (facts: FactStates, forced: boolean) => ReadonlyArray<string>
  path: PathId
  prerequisite: (facts: FactStates) => boolean
  weight: number
}>

const stateOf = (facts: FactStates, key: string): MasteryState => facts[key]?.state ?? 'unseen'
const isStable = (state: MasteryState): boolean => state === 'familiar' || state === 'fluent'

const additionPairs: ReadonlyArray<readonly [number, number]> = Array.from(
  { length: 10 },
  (_, leftIndex) =>
    Array.from(
      { length: 10 - leftIndex },
      (_, offset) => [leftIndex + 1, leftIndex + offset + 1] as const,
    ),
)
  .flat()
  .sort(([firstLeft, firstRight], [secondLeft, secondRight]) =>
    firstLeft + firstRight === secondLeft + secondRight
      ? firstLeft - secondLeft
      : firstLeft + firstRight - (secondLeft + secondRight),
  )

const additionKey = (left: number, right: number): string =>
  `add:${Math.min(left, right)}:${Math.max(left, right)}`
const additionKeys = additionPairs.map(([left, right]) => additionKey(left, right))

const subtractionKeysFor = (
  pairs: ReadonlyArray<readonly [number, number]>,
): ReadonlyArray<string> => [
  ...new Set(
    pairs.flatMap(([left, right]) => [
      `sub:${left + right}:${left}`,
      `sub:${left + right}:${right}`,
    ]),
  ),
]

const numerationKeys = [
  'numeration:round-100',
  'numeration:round-10',
  'numeration:step-10-100',
  'numeration:complement-100',
  'numeration:complement-1000',
  'numeration:double-half',
  'numeration:round-1000',
  'numeration:hundreds-on-thousands',
  'numeration:step-1000',
  'numeration:complement-10000',
] as const

const nearTenKeys = [
  'nearten:add:9',
  'nearten:add:19',
  'nearten:sub:9',
  'nearten:sub:19',
  'nearten:add:29',
  'nearten:add:39',
  'nearten:sub:29',
  'nearten:sub:39',
  'nearten:add:8',
  'nearten:add:18',
  'nearten:add:28',
  'nearten:add:38',
] as const

const columnAdditionKeys = [
  'column:add:2d:carry-0',
  'column:add:2d:carry-1',
  'column:add:3d:carry-0',
  'column:add:3d:carry-1',
  'column:add:3d:carry-2',
  'column:add:3-terms',
  'column:add:4d:carry-1',
  'column:add:4d:carry-many',
] as const

const columnSubtractionKeys = [
  'column:sub:2d:borrow-0',
  'column:sub:2d:borrow-1',
  'column:sub:3d:borrow-0',
  'column:sub:3d:borrow-1',
  'column:sub:3d:borrow-2',
  'column:sub:zero',
  'column:sub:4d:borrow-1',
  'column:sub:4d:borrow-many',
] as const

const readDenominators = [2, 4, 3, 8, 6, 5, 10, 12] as const
const equalFamilies: ReadonlyArray<readonly [number, number]> = [
  [2, 4],
  [2, 8],
  [4, 8],
  [3, 6],
  [2, 6],
  [2, 10],
  [5, 10],
  [3, 12],
  [4, 12],
  [6, 12],
  [2, 12],
]
const lineKeys = [
  'frac:line:2',
  'frac:line:4',
  'frac:line:10',
  'frac:line:5',
  'frac:line:3',
  'frac:line:6',
  'frac:line:8',
  'frac:line:12',
  'frac:line:mixed',
] as const
const compareKeys = [
  'frac:compare:same-d',
  'frac:compare:same-n',
  'frac:compare:multiple-d',
] as const
const operationKeys = [
  'frac:add:same-d',
  'frac:sub:same-d',
  'frac:complement',
  'frac:add:multiple-d',
  'frac:sub:multiple-d',
] as const

const anyStable = (facts: FactStates, keys: ReadonlyArray<string>): boolean =>
  keys.some((key) => isStable(stateOf(facts, key)))

const readKeys = readDenominators.map((denominator) => `frac:read:${denominator}`)
const equalKeys = equalFamilies.map(([small, large]) => `frac:equal:${small}-${large}`)

export const learningSkills: ReadonlyArray<SkillDefinition> = [
  {
    family: 'numbers',
    gate: 'all',
    id: 'addition-facts',
    keys: () => additionKeys,
    path: 'additions',
    prerequisite: () => true,
    weight: 1,
  },
  {
    family: 'numbers',
    gate: 'all',
    id: 'subtraction-facts',
    keys: (facts, forced) =>
      subtractionKeysFor(
        forced
          ? additionPairs
          : additionPairs.filter(
              ([left, right]) => stateOf(facts, additionKey(left, right)) === 'fluent',
            ),
      ),
    path: 'additions',
    prerequisite: (facts) =>
      additionKeys.filter((key) => stateOf(facts, key) === 'fluent').length >= 5,
    weight: 1,
  },
  {
    family: 'numbers',
    gate: 'familiar',
    id: 'numeration',
    keys: () => numerationKeys,
    path: 'big-numbers',
    prerequisite: () => true,
    weight: 1,
  },
  {
    family: 'numbers',
    gate: 'seen',
    id: 'near-ten',
    keys: () => nearTenKeys,
    path: 'big-numbers',
    prerequisite: (facts) => isStable(stateOf(facts, numerationKeys[0])),
    weight: 1,
  },
  {
    family: 'column',
    gate: 'familiar',
    id: 'column-addition',
    keys: () => columnAdditionKeys,
    path: 'big-numbers',
    prerequisite: (facts) =>
      additionKeys.filter((key) => isStable(stateOf(facts, key))).length >= 28,
    weight: 3,
  },
  {
    family: 'column',
    gate: 'familiar',
    id: 'column-subtraction',
    keys: () => columnSubtractionKeys,
    path: 'big-numbers',
    prerequisite: (facts) =>
      additionKeys.filter((key) => isStable(stateOf(facts, key))).length >= 28,
    weight: 3,
  },
  {
    family: 'fractions',
    gate: 'seen',
    id: 'fraction-read',
    keys: () => readKeys,
    path: 'fractions',
    prerequisite: () => true,
    weight: 1,
  },
  {
    family: 'fractions',
    gate: 'seen',
    id: 'fraction-equal',
    keys: () => equalKeys,
    path: 'fractions',
    prerequisite: (facts) => anyStable(facts, readKeys),
    weight: 1,
  },
  {
    family: 'fractions',
    gate: 'seen',
    id: 'fraction-line',
    keys: () => lineKeys,
    path: 'fractions',
    prerequisite: (facts) => anyStable(facts, equalKeys),
    weight: 1.5,
  },
  {
    family: 'fractions',
    gate: 'seen',
    id: 'fraction-compare',
    keys: () => compareKeys,
    path: 'fractions',
    prerequisite: (facts) => anyStable(facts, readKeys),
    weight: 1,
  },
  {
    family: 'fractions',
    gate: 'seen',
    id: 'fraction-operation',
    keys: () => operationKeys,
    path: 'fractions',
    prerequisite: (facts) => anyStable(facts, equalKeys),
    weight: 1.5,
  },
]

export const learningPathIds: ReadonlyArray<PathId> = ['additions', 'big-numbers', 'fractions']

const skillById = new Map(learningSkills.map((skill) => [skill.id, skill]))

export const skillDefinition = (id: SkillId): SkillDefinition => {
  const skill = skillById.get(id)
  if (skill === undefined) throw new Error(`Unknown learning skill ${id}`)
  return skill
}

export const skillWeight = (factKey: string): number => {
  const skill = skillForKey(factKey)
  return skill === null ? 1 : skillDefinition(skill).weight
}

export const interactionFamily = (factKey: string): InteractionFamily => {
  const skill = skillForKey(factKey)
  return skill === null ? 'numbers' : skillDefinition(skill).family
}

const openLevels = (
  keys: ReadonlyArray<string>,
  gate: LevelGate,
  facts: FactStates,
): ReadonlyArray<string> => {
  if (gate === 'all') return keys
  const open: string[] = []
  for (const key of keys) {
    open.push(key)
    const state = stateOf(facts, key)
    const passed = gate === 'seen' ? state !== 'unseen' : isStable(state)
    if (!passed) break
  }
  return open
}

export type OpenSkill = Readonly<{
  forced: boolean
  id: SkillId
  keys: ReadonlyArray<string>
}>

/**
 * Skills whose levels may appear in practice. In automatic mode, paths open once tables 1–10
 * are acquired and each skill then waits for its prerequisite; skills a parent switched on are
 * always open. In manual mode only the parent's selection is open.
 */
export const deriveOpenSkills = (
  facts: FactStates,
  settings: LearningPathSettings,
  tablesAcquired: boolean,
): ReadonlyArray<OpenSkill> =>
  learningSkills.flatMap((skill): ReadonlyArray<OpenSkill> => {
    const forced = settings.enabledSkills.includes(skill.id)
    const automatic = settings.mode === 'automatic' && tablesAcquired && skill.prerequisite(facts)
    if (!forced && !automatic) return []
    const keys = openLevels(skill.keys(facts, forced), skill.gate, facts)
    return keys.length === 0 ? [] : [{ forced, id: skill.id, keys }]
  })

export type SkillProgress = Readonly<{
  familiar: number
  fluent: number
  growing: number
  id: SkillId
  open: boolean
  openLevels: number
  prerequisiteMet: boolean
  total: number
  unseen: number
}>

export type PathProgress = Readonly<{
  id: PathId
  open: boolean
  skills: ReadonlyArray<SkillProgress>
}>

export const derivePathProgress = (
  facts: FactStates,
  settings: LearningPathSettings = defaultLearningPathSettings,
  tablesAcquired: boolean,
): ReadonlyArray<PathProgress> => {
  const open = new Map(
    deriveOpenSkills(facts, settings, tablesAcquired).map((skill) => [skill.id, skill]),
  )
  return learningPathIds.map((path) => {
    const skills = learningSkills
      .filter((skill) => skill.path === path)
      .map((skill): SkillProgress => {
        const openSkill = open.get(skill.id)
        const keys = skill.keys(facts, openSkill?.forced ?? false)
        const states = keys.map((key) => stateOf(facts, key))
        return {
          familiar: states.filter((state) => state === 'familiar').length,
          fluent: states.filter((state) => state === 'fluent').length,
          growing: states.filter((state) => state === 'learning').length,
          id: skill.id,
          open: openSkill !== undefined,
          openLevels: openSkill?.keys.length ?? 0,
          prerequisiteMet: skill.prerequisite(facts),
          total: states.length,
          unseen: states.filter((state) => state === 'unseen').length,
        }
      })
    return { id: path, open: skills.some((skill) => skill.open), skills }
  })
}

/* ------------------------------------------------------------------------------------------ */
/* Generators                                                                                 */
/* ------------------------------------------------------------------------------------------ */

type Random = () => number

const integer = (random: Random, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1))

const pick = <A>(random: Random, values: ReadonlyArray<A>): A => {
  const value = values[Math.floor(random() * values.length)]
  if (value === undefined) throw new Error('Cannot pick from an empty list')
  return value
}

const shuffled = <A>(values: ReadonlyArray<A>, random: Random): ReadonlyArray<A> => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const value = result[index] as A
    result[index] = result[other] as A
    result[other] = value
  }
  return result
}

/** Plausible neighbours used when an exercise's own distractors run out. */
const fallbackCandidates = (answer: PracticeAnswer): ReadonlyArray<PracticeAnswer> => {
  if (answer.type === 'integer') {
    return [1, 2, 3, 4, 5, 10].flatMap((offset) =>
      [answer.value + offset, answer.value - offset]
        .filter((value) => value >= 0 && value <= MAX_WHOLE_NUMBER)
        .map((value) => ({ type: 'integer' as const, value })),
    )
  }
  if (answer.type === 'fraction') {
    const denominators = [answer.denominator, 2, 3, 4, 5, 6, 8, 10, 12]
    return denominators.flatMap((denominator) =>
      Array.from({ length: denominator + 1 }, (_, numerator) => ({
        denominator,
        numerator,
        type: 'fraction' as const,
        whole: answer.whole,
      })).filter(({ numerator }) => numerator > 0 || answer.whole > 0),
    )
  }
  return []
}

/** Three distinct distractors plus the answer, shuffled. Distractors never equal the answer. */
const tileChoices = (
  exercise: Exercise,
  candidates: ReadonlyArray<PracticeAnswer>,
  random: Random,
): ReadonlyArray<PracticeAnswer> => {
  const answer = expectedAnswer(exercise)
  const keyOf = (value: PracticeAnswer): string => JSON.stringify(value)
  const seen = new Set([keyOf(answer)])
  const wrong: PracticeAnswer[] = []
  for (const candidate of [...shuffled(candidates, random), ...fallbackCandidates(answer)]) {
    if (wrong.length >= 3) break
    const key = keyOf(candidate)
    if (seen.has(key) || isExerciseAnswerCorrect(exercise, candidate)) continue
    seen.add(key)
    wrong.push(candidate)
  }
  return shuffled([answer, ...wrong], random)
}

const integerCandidates = (
  value: number,
  offsets: ReadonlyArray<number>,
): ReadonlyArray<PracticeAnswer> =>
  offsets
    .map((offset) => value + offset)
    .filter((candidate) => candidate >= 0 && candidate <= MAX_WHOLE_NUMBER)
    .map((candidate) => ({ type: 'integer' as const, value: candidate }))

const fractionAnswer = (
  numerator: number,
  denominator: number,
  whole = 0,
): PracticeAnswer | null =>
  denominator >= 1 &&
  denominator <= 12 &&
  numerator >= 0 &&
  numerator <= 12 &&
  numerator <= denominator
    ? { denominator, numerator, type: 'fraction', whole }
    : null

const fractionCandidates = (
  values: ReadonlyArray<readonly [number, number] | readonly [number, number, number]>,
): ReadonlyArray<PracticeAnswer> =>
  values.flatMap(([numerator, denominator, whole]) => {
    const value = fractionAnswer(numerator, denominator, whole ?? 0)
    return value === null ? [] : [value]
  })

type GeneratorContext = Readonly<{ random: Random; recall: boolean }>

const withArithmeticChoices = (
  exercise: Extract<Exercise, { kind: 'arithmetic' }>,
  { random, recall }: GeneratorContext,
  offsets: ReadonlyArray<number>,
): Exercise => {
  if (recall) return exercise
  const answer = expectedAnswer(exercise)
  const value = answer.type === 'integer' ? answer.value : 0
  return { ...exercise, choices: tileChoices(exercise, integerCandidates(value, offsets), random) }
}

const arithmetic = (
  skill: Extract<Exercise, { kind: 'arithmetic' }>['skill'],
  operation: Extract<Exercise, { kind: 'arithmetic' }>['operation'],
  left: number,
  right: number,
  blank: Extract<Exercise, { kind: 'arithmetic' }>['blank'] = 'result',
  resultFirst = false,
): Extract<Exercise, { kind: 'arithmetic' }> => ({
  blank,
  choices: [],
  kind: 'arithmetic',
  left,
  operation,
  resultFirst,
  right,
  skill,
})

const factBlank = (random: Random): Extract<Exercise, { kind: 'arithmetic' }>['blank'] => {
  const draw = random()
  return draw < 0.5 ? 'result' : draw < 0.75 ? 'right' : 'left'
}

const generateAdditionFact = (key: string, context: GeneratorContext): Exercise => {
  const [, first = 1, second = 1] = key.split(':').map(Number)
  const swap = context.random() < 0.5
  const blank = factBlank(context.random)
  return withArithmeticChoices(
    arithmetic(
      'addition-facts',
      'add',
      swap ? second : first,
      swap ? first : second,
      blank,
      blank !== 'result' && context.random() < 0.4,
    ),
    context,
    [-1, 1, -2, 2, 10, -10],
  )
}

const generateSubtractionFact = (key: string, context: GeneratorContext): Exercise => {
  const [, total = 2, part = 1] = key.split(':').map(Number)
  const blank = context.random() < 0.7 ? 'result' : 'right'
  return withArithmeticChoices(
    arithmetic('subtraction-facts', 'subtract', total, part, blank, false),
    context,
    [-1, 1, -2, 2, part, total],
  )
}

const roundTo = (value: number, step: number): number => Math.round(value / step) * step

const generateNumeration = (key: string, context: GeneratorContext): Exercise => {
  const { random } = context
  const add = random() < 0.55
  const placeValueOffsets = [-1, 1, -10, 10, -100, 100, -1000, 1000]
  switch (key) {
    case 'numeration:round-100': {
      const left = integer(random, add ? 1 : 3, add ? 8 : 9) * 100
      const right = integer(random, 1, add ? 10 - left / 100 : left / 100 - 1) * 100
      return withArithmeticChoices(
        arithmetic('numeration', add ? 'add' : 'subtract', left, right),
        context,
        placeValueOffsets,
      )
    }
    case 'numeration:round-10': {
      const hundreds = integer(random, 1, 9) * 100
      const tensLeft = integer(random, add ? 1 : 3, add ? 7 : 9)
      const tensRight = integer(random, 1, add ? 9 - tensLeft : tensLeft - 1)
      return withArithmeticChoices(
        arithmetic(
          'numeration',
          add ? 'add' : 'subtract',
          hundreds + tensLeft * 10,
          tensRight * 10,
        ),
        context,
        placeValueOffsets,
      )
    }
    case 'numeration:step-10-100': {
      const step = random() < 0.5 ? 10 : 100
      const left = add ? integer(random, 101, 989 - step) : integer(random, 110 + step, 999)
      return withArithmeticChoices(
        arithmetic('numeration', add ? 'add' : 'subtract', left, step),
        context,
        placeValueOffsets,
      )
    }
    case 'numeration:complement-100': {
      const toHundred = random() < 0.5
      const left = toHundred ? integer(random, 1, 19) * 5 : integer(random, 11, 99) * 10
      const target = toHundred ? 100 : Math.ceil((left + 1) / 100) * 100
      return withArithmeticChoices(
        arithmetic('numeration', 'add', left, target - left, 'right', random() < 0.3),
        context,
        [-10, 10, -5, 5, -100, 100],
      )
    }
    case 'numeration:complement-1000': {
      const left = integer(random, 1, 19) * 50
      return withArithmeticChoices(
        arithmetic('numeration', 'add', left, 1000 - left, random() < 0.5 ? 'right' : 'left'),
        context,
        [-50, 50, -100, 100, -10, 10],
      )
    }
    case 'numeration:double-half': {
      const double = random() < 0.5
      const value = double
        ? pick(random, [100, 150, 200, 250, 300, 400, 500, 600])
        : pick(random, [200, 300, 400, 500, 600, 800, 1000, 1200])
      return withArithmeticChoices(
        arithmetic('numeration', double ? 'double' : 'half', value, 2),
        context,
        double ? [-50, 50, -100, 100, value, -value / 2] : [-50, 50, -100, 100, value * 1.5],
      )
    }
    case 'numeration:round-1000': {
      const left = integer(random, add ? 1 : 3, add ? 8 : 9) * 1000
      const right = integer(random, 1, add ? 10 - left / 1000 : left / 1000 - 1) * 1000
      return withArithmeticChoices(
        arithmetic('numeration', add ? 'add' : 'subtract', left, right),
        context,
        placeValueOffsets,
      )
    }
    case 'numeration:hundreds-on-thousands': {
      const thousands = integer(random, 1, 9) * 1000
      const hundredsLeft = integer(random, add ? 1 : 3, add ? 7 : 9)
      const hundredsRight = integer(random, 1, add ? 9 - hundredsLeft : hundredsLeft - 1)
      return withArithmeticChoices(
        arithmetic(
          'numeration',
          add ? 'add' : 'subtract',
          thousands + hundredsLeft * 100,
          hundredsRight * 100,
        ),
        context,
        placeValueOffsets,
      )
    }
    case 'numeration:step-1000': {
      const step = pick(random, [10, 100, 1000])
      const left = add
        ? integer(random, 1001, MAX_WHOLE_NUMBER - step - 1)
        : integer(random, 1000 + step, 9999)
      return withArithmeticChoices(
        arithmetic('numeration', add ? 'add' : 'subtract', left, step),
        context,
        placeValueOffsets,
      )
    }
    default: {
      const toTenThousand = random() < 0.5
      const left = toTenThousand
        ? integer(random, 1, 9) * 1000
        : roundTo(integer(random, 1100, 9800), 100)
      const target = toTenThousand ? MAX_WHOLE_NUMBER : Math.ceil((left + 1) / 1000) * 1000
      return withArithmeticChoices(
        arithmetic('numeration', 'add', left, target - left, random() < 0.5 ? 'right' : 'left'),
        context,
        [-100, 100, -1000, 1000, -10, 10],
      )
    }
  }
}

const generateNearTen = (key: string, context: GeneratorContext): Exercise => {
  const [, operation, amountText] = key.split(':')
  const amount = Number(amountText)
  const { random } = context
  const fourDigits = context.recall && random() < 0.3
  const left = fourDigits
    ? integer(random, 1000, 9900)
    : operation === 'add'
      ? integer(random, 100, 959)
      : integer(random, Math.max(100, amount + 11), 999)
  return withArithmeticChoices(
    arithmetic('near-ten', operation === 'add' ? 'add' : 'subtract', left, amount),
    context,
    [-2, 2, -1, 1, -10, 10],
  )
}

const digitsOf = (value: number): ReadonlyArray<number> =>
  String(value).split('').reverse().map(Number)

/** Number of columns that carry when the terms are added in columns. */
export const countCarries = (terms: ReadonlyArray<number>): number => {
  const width = Math.max(...terms.map((term) => String(term).length))
  let carry = 0
  let carries = 0
  for (let column = 0; column < width; column += 1) {
    const total = terms.reduce((sum, term) => sum + (digitsOf(term)[column] ?? 0), carry)
    carry = Math.floor(total / 10)
    if (carry > 0) carries += 1
  }
  return carries
}

/** Number of columns that need an exchange when the second term is subtracted in columns. */
export const countBorrows = (top: number, bottom: number): number => {
  const topDigits = digitsOf(top)
  const bottomDigits = digitsOf(bottom)
  let borrow = 0
  let borrows = 0
  for (let column = 0; column < topDigits.length; column += 1) {
    const needed = (bottomDigits[column] ?? 0) + borrow
    borrow = (topDigits[column] ?? 0) < needed ? 1 : 0
    borrows += borrow
  }
  return borrows
}

const numberWithDigits = (random: Random, digits: number): number =>
  integer(random, 10 ** (digits - 1), 10 ** digits - 1)

const searchTerms = (
  random: Random,
  generate: () => ReadonlyArray<number>,
  accept: (terms: ReadonlyArray<number>) => boolean,
  fallback: ReadonlyArray<number>,
): ReadonlyArray<number> => {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const terms = generate()
    if (accept(terms)) return terms
  }
  return fallback
}

const generateColumnAddition = (key: string, { random }: GeneratorContext): Exercise => {
  const level = key.slice('column:add:'.length)
  const make = (
    digits: number,
    carries: (count: number) => boolean,
    fallback: ReadonlyArray<number>,
  ) =>
    searchTerms(
      random,
      () => [
        numberWithDigits(random, digits),
        numberWithDigits(random, random() < 0.7 ? digits : Math.max(1, digits - 1)),
      ],
      (terms) =>
        carries(countCarries(terms)) &&
        terms.reduce((sum, term) => sum + term, 0) <=
          (digits === 4 ? MAX_WHOLE_NUMBER : 10 ** digits - 1),
      fallback,
    )
  const terms =
    level === '2d:carry-0'
      ? make(2, (count) => count === 0, [42, 35])
      : level === '2d:carry-1'
        ? make(2, (count) => count === 1, [47, 38])
        : level === '3d:carry-0'
          ? make(3, (count) => count === 0, [245, 432])
          : level === '3d:carry-1'
            ? make(3, (count) => count === 1, [245, 437])
            : level === '3d:carry-2'
              ? make(3, (count) => count === 2, [368, 274])
              : level === '3-terms'
                ? searchTerms(
                    random,
                    () => [
                      numberWithDigits(random, 2),
                      numberWithDigits(random, 1),
                      numberWithDigits(random, 3),
                    ],
                    (candidate) => candidate.reduce((sum, term) => sum + term, 0) <= 999,
                    [76, 7, 568],
                  )
                : level === '4d:carry-1'
                  ? make(4, (count) => count === 1, [2345, 3418])
                  : make(4, (count) => count >= 2, [4687, 2756])
  return { kind: 'column', operation: 'add', skill: 'column-addition', terms }
}

const generateColumnSubtraction = (key: string, { random }: GeneratorContext): Exercise => {
  const level = key.slice('column:sub:'.length)
  const make = (
    digits: number,
    borrows: (count: number) => boolean,
    fallback: readonly [number, number],
  ) =>
    searchTerms(
      random,
      () => {
        const top = numberWithDigits(random, digits)
        const bottom = numberWithDigits(random, random() < 0.7 ? digits : Math.max(1, digits - 1))
        return [top, bottom]
      },
      ([top = 0, bottom = 0]) => top > bottom && borrows(countBorrows(top, bottom)),
      fallback,
    )
  const terms =
    level === '2d:borrow-0'
      ? make(2, (count) => count === 0, [68, 25])
      : level === '2d:borrow-1'
        ? make(2, (count) => count === 1, [62, 37])
        : level === '3d:borrow-0'
          ? make(3, (count) => count === 0, [586, 243])
          : level === '3d:borrow-1'
            ? make(3, (count) => count === 1, [574, 239])
            : level === '3d:borrow-2'
              ? make(3, (count) => count === 2, [523, 167])
              : level === 'zero'
                ? searchTerms(
                    random,
                    () =>
                      random() < 0.6
                        ? [
                            integer(random, 1, 9) * 100 + integer(random, 1, 9),
                            numberWithDigits(random, 3),
                          ]
                        : [integer(random, 2, 9) * 1000, numberWithDigits(random, 4)],
                    ([top = 0, bottom = 0]) => top > bottom && countBorrows(top, bottom) >= 2,
                    [503, 128],
                  )
                : level === '4d:borrow-1'
                  ? make(4, (count) => count === 1, [5847, 2394])
                  : make(4, (count) => count >= 2, [6132, 2758])
  return { kind: 'column', operation: 'subtract', skill: 'column-subtraction', terms }
}

const generateFractionRead = (key: string, context: GeneratorContext): Exercise => {
  const { random, recall } = context
  const denominator = Number(key.split(':')[2])
  const numerator = denominator === 2 ? 1 : integer(random, 1, denominator - 1)
  const shape = denominator <= 8 && random() < 0.35 ? 'pot' : 'bed'
  const fraction = { denominator, numerator }
  if (recall) {
    return {
      choices: [],
      fraction,
      kind: 'fraction-read',
      mode: random() < 0.45 ? 'build' : 'read',
      shape,
      skill: 'fraction-read',
    }
  }
  const exercise: Exercise = {
    choices: [],
    fraction,
    kind: 'fraction-read',
    mode: 'read',
    shape,
    skill: 'fraction-read',
  }
  const empty = denominator - numerator
  return {
    ...exercise,
    choices: tileChoices(
      exercise,
      fractionCandidates([
        [empty, denominator],
        [numerator, empty],
        [numerator + 1, denominator],
        [numerator - 1, denominator],
        [numerator, denominator + 1],
        [numerator, denominator - 1],
      ]),
      random,
    ),
  }
}

const pickOptionsFor = (reference: Fraction, random: Random): FractionPickExercise['options'] => {
  const equal: Fraction[] = []
  for (
    let denominator = reference.denominator * 2;
    denominator <= 12;
    denominator += reference.denominator
  ) {
    equal.push({
      denominator,
      numerator: (reference.numerator * denominator) / reference.denominator,
    })
  }
  const chosenEqual = shuffled(equal, random).slice(0, Math.min(2, equal.length))
  const options: Fraction[] = [...chosenEqual]
  const candidates: ReadonlyArray<Fraction> = shuffled(
    [
      ...chosenEqual.flatMap((fraction) => [
        { denominator: fraction.denominator, numerator: fraction.numerator + 1 },
        { denominator: fraction.denominator, numerator: fraction.numerator - 1 },
        { denominator: fraction.denominator, numerator: reference.numerator },
      ]),
      { denominator: reference.denominator, numerator: reference.numerator + 1 },
      { denominator: reference.denominator + 1, numerator: reference.numerator },
    ],
    random,
  )
  for (const candidate of candidates) {
    if (options.length >= Math.min(5, chosenEqual.length + 3)) break
    if (candidate.numerator < 1 || candidate.numerator > candidate.denominator) continue
    if (candidate.denominator > 12) continue
    if (compareFractions(candidate, reference) === '=') continue
    if (options.some((option) => compareFractions(option, candidate) === '=')) continue
    options.push(candidate)
  }
  return shuffled(options, random)
}

const generateFractionEqual = (key: string, context: GeneratorContext): Exercise => {
  const { random, recall } = context
  const [small = 2, large = 4] = (key.split(':')[2] ?? '2-4').split('-').map(Number)
  const scale = large / small
  const numerator = integer(random, 1, small - 1)
  const smallFraction = { denominator: small, numerator }
  const largeFraction = { denominator: large, numerator: numerator * scale }
  if (recall && random() < 0.35) {
    const exercise: FractionPickExercise = {
      kind: 'fraction-pick',
      options: pickOptionsFor(smallFraction, random),
      reference: smallFraction,
      skill: 'fraction-equal',
    }
    if (equalOptionIndexes(exercise).length > 0 && exercise.options.length >= 3) return exercise
  }
  const forward = random() < 0.7
  const blank = random() < 0.75 ? 'numerator' : 'denominator'
  const exercise: Exercise = {
    blank,
    choices: [],
    kind: 'fraction-equal',
    known: forward ? smallFraction : largeFraction,
    skill: 'fraction-equal',
    target: forward ? largeFraction : smallFraction,
  }
  if (recall) return exercise
  const answer = exercise.target[blank]
  return {
    ...exercise,
    choices: tileChoices(
      exercise,
      integerCandidates(answer, [-1, 1, 2, -2]).concat(
        integerCandidates(0, [exercise.known[blank], scale, answer * scale]),
      ),
      random,
    ),
  }
}

const generateFractionLine = (key: string, context: GeneratorContext): Exercise => {
  const { random, recall } = context
  const level = key.split(':')[2] ?? '2'
  const mixed = level === 'mixed'
  const denominator = mixed ? pick(random, [2, 4, 5, 10]) : Number(level)
  const finerTicks = [12, 10, 8].filter(
    (ticks) => ticks !== denominator && ticks % denominator === 0,
  )
  const ticks =
    !mixed && recall && finerTicks.length > 0 && random() < 0.35
      ? pick(random, finerTicks)
      : denominator
  const target = mixed
    ? { denominator, numerator: integer(random, 1, denominator - 1), whole: 1 }
    : { denominator, numerator: integer(random, 1, denominator), whole: 0 }
  const normalisedTarget =
    target.numerator === target.denominator
      ? { denominator, numerator: 0, whole: target.whole + 1 }
      : target
  const mode = recall && random() < 0.6 ? 'place' : 'read'
  const exercise: Exercise = {
    choices: [],
    kind: 'fraction-line',
    mode,
    skill: 'fraction-line',
    target: normalisedTarget,
    ticks,
    units: mixed ? 2 : 1,
  }
  if (recall || mode === 'place') return exercise
  const { numerator, whole } = normalisedTarget
  return {
    ...exercise,
    choices: tileChoices(
      exercise,
      fractionCandidates([
        [numerator + 1, denominator, whole],
        [Math.max(0, numerator - 1), denominator, whole],
        [denominator - numerator, denominator, whole],
        [numerator, denominator + 1, whole],
        [numerator, denominator, whole === 0 ? 1 : 0],
      ]),
      random,
    ),
  }
}

const generateFractionCompare = (key: string, { random }: GeneratorContext): Exercise => {
  const level = key.split(':')[2]
  if (level === 'same-d') {
    const denominator = integer(random, 3, 12)
    const first = integer(random, 1, denominator - 1)
    let second = integer(random, 1, denominator - 1)
    if (second === first) second = first === 1 ? 2 : first - 1
    return {
      kind: 'fraction-compare',
      left: { denominator, numerator: first },
      right: { denominator, numerator: second },
      skill: 'fraction-compare',
    }
  }
  if (level === 'same-n') {
    const numerator = integer(random, 1, 5)
    const first = integer(random, numerator + 1, 12)
    let second = integer(random, numerator + 1, 12)
    if (second === first) second = first === 12 ? 11 : first + 1
    return {
      kind: 'fraction-compare',
      left: { denominator: first, numerator },
      right: { denominator: second, numerator },
      skill: 'fraction-compare',
    }
  }
  const [small, large] = pick(random, equalFamilies)
  const scale = large / small
  const smallNumerator = integer(random, 1, small - 1)
  const largeNumerator =
    random() < 0.25
      ? smallNumerator * scale
      : pick(
          random,
          [smallNumerator * scale - 1, smallNumerator * scale + 1].filter(
            (value) => value >= 1 && value < large,
          ),
        )
  const smallFirst = random() < 0.5
  const smallFraction = { denominator: small, numerator: smallNumerator }
  const largeFraction = { denominator: large, numerator: largeNumerator }
  return {
    kind: 'fraction-compare',
    left: smallFirst ? smallFraction : largeFraction,
    right: smallFirst ? largeFraction : smallFraction,
    skill: 'fraction-compare',
  }
}

const generateFractionOperation = (key: string, context: GeneratorContext): Exercise => {
  const { random, recall } = context
  const base = {
    choices: [],
    kind: 'fraction-operation' as const,
    skill: 'fraction-operation' as const,
    story: false,
  }
  let exercise: Extract<Exercise, { kind: 'fraction-operation' }>
  if (key === 'frac:add:same-d' || key === 'frac:sub:same-d') {
    const denominator = integer(random, 3, 12)
    const add = key === 'frac:add:same-d'
    const first = add ? integer(random, 1, denominator - 1) : integer(random, 2, denominator)
    const second = add ? integer(random, 1, denominator - first) : integer(random, 1, first - 1)
    exercise = {
      ...base,
      left: { denominator, numerator: first },
      operation: add ? 'add' : 'subtract',
      right: { denominator, numerator: second },
    }
  } else if (key === 'frac:complement') {
    const denominator = integer(random, 3, 12)
    exercise = {
      ...base,
      left: { denominator, numerator: denominator },
      operation: 'subtract',
      right: { denominator, numerator: integer(random, 1, denominator - 1) },
      story: random() < 0.5,
    }
  } else {
    const [small, large] = pick(random, equalFamilies)
    const scale = large / small
    const add = key === 'frac:add:multiple-d'
    const smallNumerator = integer(random, 1, small - 1)
    const scaledSmall = smallNumerator * scale
    const largeNumerator = add
      ? integer(random, 1, Math.max(1, large - scaledSmall))
      : integer(random, 1, Math.max(1, scaledSmall - 1))
    const smallFraction = { denominator: small, numerator: smallNumerator }
    const largeFraction = { denominator: large, numerator: largeNumerator }
    const smallFirst = !add || random() < 0.5
    exercise = {
      ...base,
      left: smallFirst ? smallFraction : largeFraction,
      operation: add ? 'add' : 'subtract',
      right: smallFirst ? largeFraction : smallFraction,
    }
    const result = fractionOperationResult(exercise)
    if (result.numerator < 0 || result.numerator > result.denominator) {
      exercise = {
        ...base,
        left: { denominator: 4, numerator: 1 },
        operation: add ? 'add' : 'subtract',
        right: { denominator: 2, numerator: 1 },
      }
      if (!add)
        exercise = {
          ...exercise,
          left: { denominator: 2, numerator: 1 },
          right: { denominator: 4, numerator: 1 },
        }
    }
  }
  if (recall) return exercise
  const result = fractionOperationResult(exercise)
  const { left, right } = exercise
  return {
    ...exercise,
    choices: tileChoices(
      exercise,
      fractionCandidates([
        [left.numerator + right.numerator, left.denominator + right.denominator],
        [
          Math.abs(left.numerator - right.numerator),
          Math.abs(left.denominator - right.denominator),
        ],
        [result.numerator + 1, result.denominator],
        [Math.max(0, result.numerator - 1), result.denominator],
        [result.numerator, Math.min(left.denominator, right.denominator)],
      ]),
      random,
    ),
  }
}

/** Builds one exercise for a skill level. Recall asks the learner to produce the answer. */
export const generateExercise = (key: string, context: GeneratorContext): Exercise => {
  const skill = skillForKey(key)
  switch (skill) {
    case 'addition-facts':
      return generateAdditionFact(key, context)
    case 'subtraction-facts':
      return generateSubtractionFact(key, context)
    case 'numeration':
      return generateNumeration(key, context)
    case 'near-ten':
      return generateNearTen(key, context)
    case 'column-addition':
      return generateColumnAddition(key, context)
    case 'column-subtraction':
      return generateColumnSubtraction(key, context)
    case 'fraction-read':
      return generateFractionRead(key, context)
    case 'fraction-equal':
      return generateFractionEqual(key, context)
    case 'fraction-line':
      return generateFractionLine(key, context)
    case 'fraction-compare':
      return generateFractionCompare(key, context)
    case 'fraction-operation':
      return generateFractionOperation(key, context)
    case null:
      throw new Error(`No exercise generator for ${key}`)
  }
}

export const LearningPaths = {
  deriveOpenSkills,
  derivePathProgress,
  generateExercise,
  interactionFamily,
  isProductionExercise,
  skillWeight,
} as const

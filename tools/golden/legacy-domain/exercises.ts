import { Schema } from 'effect'

export const PathIdSchema = Schema.Literals(['additions', 'big-numbers', 'fractions'])
export type PathId = typeof PathIdSchema.Type

export const SkillIdSchema = Schema.Literals([
  'addition-facts',
  'subtraction-facts',
  'numeration',
  'near-ten',
  'column-addition',
  'column-subtraction',
  'fraction-read',
  'fraction-equal',
  'fraction-line',
  'fraction-compare',
  'fraction-operation',
])
export type SkillId = typeof SkillIdSchema.Type

export const SubtractionMethodSchema = Schema.Literals(['compensation', 'decomposition'])
export type SubtractionMethod = typeof SubtractionMethodSchema.Type

export const LearningPathSettingsSchema = Schema.Struct({
  enabledSkills: Schema.Array(SkillIdSchema).pipe(Schema.check(Schema.isMaxLength(11))),
  focusSkill: Schema.NullOr(SkillIdSchema),
  mode: Schema.Literals(['automatic', 'manual']),
  subtractionMethod: SubtractionMethodSchema,
})
export type LearningPathSettings = typeof LearningPathSettingsSchema.Type

export const defaultLearningPathSettings: LearningPathSettings = {
  enabledSkills: [],
  focusSkill: null,
  mode: 'automatic',
  subtractionMethod: 'compensation',
}

/** The CE2 number field: every number and every result stays at or below 10 000. */
export const MAX_WHOLE_NUMBER = 10_000
export const MAX_DENOMINATOR = 12

const WholeNumberSchema = Schema.Int.check(
  Schema.isBetween({ maximum: MAX_WHOLE_NUMBER, minimum: 0 }),
)
const DenominatorSchema = Schema.Int.check(
  Schema.isBetween({ maximum: MAX_DENOMINATOR, minimum: 1 }),
)

export const FractionSchema = Schema.Struct({
  denominator: DenominatorSchema,
  numerator: Schema.Int.check(Schema.isBetween({ maximum: MAX_DENOMINATOR, minimum: 0 })),
})
export type Fraction = typeof FractionSchema.Type

export const MixedFractionSchema = Schema.Struct({
  denominator: DenominatorSchema,
  numerator: Schema.Int.check(Schema.isBetween({ maximum: MAX_DENOMINATOR, minimum: 0 })),
  whole: Schema.Int.check(Schema.isBetween({ maximum: 2, minimum: 0 })),
})
export type MixedFraction = typeof MixedFractionSchema.Type

export const PracticeAnswerSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal('integer'), value: WholeNumberSchema }),
  Schema.Struct({
    denominator: Schema.Int.check(Schema.isBetween({ maximum: 99, minimum: 1 })),
    numerator: Schema.Int.check(Schema.isBetween({ maximum: 99, minimum: 0 })),
    type: Schema.Literal('fraction'),
    whole: Schema.Int.check(Schema.isBetween({ maximum: 2, minimum: 0 })),
  }),
  Schema.Struct({ symbol: Schema.Literals(['<', '=', '>']), type: Schema.Literal('comparison') }),
  Schema.Struct({
    index: Schema.Int.check(Schema.isBetween({ maximum: 48, minimum: 0 })),
    type: Schema.Literal('tick'),
  }),
  Schema.Struct({
    ids: Schema.Array(Schema.Int.check(Schema.isBetween({ maximum: 24, minimum: 0 }))).pipe(
      Schema.check(Schema.isMaxLength(24)),
    ),
    type: Schema.Literal('selection'),
  }),
])
export type PracticeAnswer = typeof PracticeAnswerSchema.Type

const ChoicesSchema = Schema.Array(PracticeAnswerSchema).pipe(Schema.check(Schema.isMaxLength(6)))

const ArithmeticExerciseSchema = Schema.Struct({
  blank: Schema.Literals(['result', 'left', 'right']),
  choices: ChoicesSchema,
  kind: Schema.Literal('arithmetic'),
  left: WholeNumberSchema,
  operation: Schema.Literals(['add', 'subtract', 'double', 'half']),
  resultFirst: Schema.Boolean,
  right: WholeNumberSchema,
  skill: Schema.Literals(['addition-facts', 'subtraction-facts', 'numeration', 'near-ten']),
})

const ColumnExerciseSchema = Schema.Struct({
  kind: Schema.Literal('column'),
  operation: Schema.Literals(['add', 'subtract']),
  skill: Schema.Literals(['column-addition', 'column-subtraction']),
  terms: Schema.Array(
    Schema.Int.check(Schema.isBetween({ maximum: MAX_WHOLE_NUMBER, minimum: 1 })),
  ).pipe(Schema.check(Schema.isMinLength(2), Schema.isMaxLength(3))),
})

const FractionReadExerciseSchema = Schema.Struct({
  choices: ChoicesSchema,
  fraction: FractionSchema,
  kind: Schema.Literal('fraction-read'),
  mode: Schema.Literals(['read', 'build']),
  shape: Schema.Literals(['bed', 'pot']),
  skill: Schema.Literal('fraction-read'),
})

const FractionEqualExerciseSchema = Schema.Struct({
  blank: Schema.Literals(['numerator', 'denominator']),
  choices: ChoicesSchema,
  kind: Schema.Literal('fraction-equal'),
  known: FractionSchema,
  skill: Schema.Literal('fraction-equal'),
  target: FractionSchema,
})

const FractionPickExerciseSchema = Schema.Struct({
  kind: Schema.Literal('fraction-pick'),
  options: Schema.Array(FractionSchema).pipe(
    Schema.check(Schema.isMinLength(3), Schema.isMaxLength(6)),
  ),
  reference: FractionSchema,
  skill: Schema.Literal('fraction-equal'),
})

const FractionLineExerciseSchema = Schema.Struct({
  choices: ChoicesSchema,
  kind: Schema.Literal('fraction-line'),
  mode: Schema.Literals(['place', 'read']),
  skill: Schema.Literal('fraction-line'),
  target: MixedFractionSchema,
  ticks: DenominatorSchema,
  units: Schema.Literals([1, 2]),
})

const FractionCompareExerciseSchema = Schema.Struct({
  kind: Schema.Literal('fraction-compare'),
  left: FractionSchema,
  right: FractionSchema,
  skill: Schema.Literal('fraction-compare'),
})

const FractionOperationExerciseSchema = Schema.Struct({
  choices: ChoicesSchema,
  kind: Schema.Literal('fraction-operation'),
  left: FractionSchema,
  operation: Schema.Literals(['add', 'subtract']),
  right: FractionSchema,
  skill: Schema.Literal('fraction-operation'),
  story: Schema.Boolean,
})

export const ExerciseSchema = Schema.Union([
  ArithmeticExerciseSchema,
  ColumnExerciseSchema,
  FractionReadExerciseSchema,
  FractionEqualExerciseSchema,
  FractionPickExerciseSchema,
  FractionLineExerciseSchema,
  FractionCompareExerciseSchema,
  FractionOperationExerciseSchema,
])
export type Exercise = typeof ExerciseSchema.Type
export type ArithmeticExercise = typeof ArithmeticExerciseSchema.Type
export type ColumnExercise = typeof ColumnExerciseSchema.Type
export type FractionReadExercise = typeof FractionReadExerciseSchema.Type
export type FractionEqualExercise = typeof FractionEqualExerciseSchema.Type
export type FractionPickExercise = typeof FractionPickExerciseSchema.Type
export type FractionLineExercise = typeof FractionLineExerciseSchema.Type
export type FractionCompareExercise = typeof FractionCompareExerciseSchema.Type
export type FractionOperationExercise = typeof FractionOperationExerciseSchema.Type

const skillKeyPatterns: ReadonlyArray<readonly [SkillId, RegExp]> = [
  ['addition-facts', /^add:\d+:\d+$/],
  ['subtraction-facts', /^sub:\d+:\d+$/],
  ['numeration', /^numeration:[a-z0-9-]+$/],
  ['near-ten', /^nearten:(add|sub):\d+$/],
  ['column-addition', /^column:add:[a-z0-9-]+(:[a-z0-9-]+)?$/],
  ['column-subtraction', /^column:sub:[a-z0-9-]+(:[a-z0-9-]+)?$/],
  ['fraction-read', /^frac:read:\d+$/],
  ['fraction-equal', /^frac:equal:\d+-\d+$/],
  ['fraction-line', /^frac:line:[a-z0-9]+$/],
  ['fraction-compare', /^frac:compare:[a-z-]+$/],
  ['fraction-operation', /^frac:(add|sub|complement)(:[a-z-]+)?$/],
]

export const skillForKey = (factKey: string): SkillId | null =>
  skillKeyPatterns.find(([, pattern]) => pattern.test(factKey))?.[0] ?? null

const gcd = (first: number, second: number): number =>
  second === 0 ? Math.abs(first) : gcd(second, first % second)

/** Numerator over a shared denominator, so equal values compare exactly without floats. */
const scaled = (
  value: Readonly<{ denominator: number; numerator: number; whole?: number | undefined }>,
  denominator: number,
): number =>
  ((value.whole ?? 0) * value.denominator + value.numerator) * (denominator / value.denominator)

const sameValue = (
  first: Readonly<{ denominator: number; numerator: number; whole?: number | undefined }>,
  second: Readonly<{ denominator: number; numerator: number; whole?: number | undefined }>,
): boolean => {
  const common = first.denominator * second.denominator
  return scaled(first, common) === scaled(second, common)
}

export const compareFractions = (first: Fraction, second: Fraction): '<' | '=' | '>' => {
  const common = first.denominator * second.denominator
  const difference = scaled(first, common) - scaled(second, common)
  return difference === 0 ? '=' : difference < 0 ? '<' : '>'
}

export const simplifyFraction = (fraction: Fraction): Fraction => {
  if (fraction.numerator === 0) return { denominator: 1, numerator: 0 }
  const divisor = gcd(fraction.numerator, fraction.denominator)
  return {
    denominator: fraction.denominator / divisor,
    numerator: fraction.numerator / divisor,
  }
}

export const fractionOperationResult = (exercise: FractionOperationExercise): Fraction => {
  const denominator = Math.max(exercise.left.denominator, exercise.right.denominator)
  const left = scaled(exercise.left, denominator)
  const right = scaled(exercise.right, denominator)
  return {
    denominator,
    numerator: exercise.operation === 'add' ? left + right : left - right,
  }
}

const arithmeticResult = ({ left, operation, right }: ArithmeticExercise): number =>
  operation === 'add'
    ? left + right
    : operation === 'subtract'
      ? left - right
      : operation === 'double'
        ? left * 2
        : left / 2

export const columnResult = ({ operation, terms }: ColumnExercise): number =>
  operation === 'add'
    ? terms.reduce((total, term) => total + term, 0)
    : (terms[0] ?? 0) - (terms[1] ?? 0)

/** The graduation the target sits on, counted from zero in steps of one tick. */
export const lineTickIndex = ({ target, ticks }: FractionLineExercise): number =>
  ((target.whole * target.denominator + target.numerator) * ticks) / target.denominator

export const equalOptionIndexes = (exercise: FractionPickExercise): ReadonlyArray<number> =>
  exercise.options.flatMap((option, index) =>
    sameValue(option, exercise.reference) ? [index] : [],
  )

/** The canonical answer shown after a question, in the form the exercise was written in. */
export const expectedAnswer = (exercise: Exercise): PracticeAnswer => {
  switch (exercise.kind) {
    case 'arithmetic': {
      const value =
        exercise.blank === 'result'
          ? arithmeticResult(exercise)
          : exercise.blank === 'left'
            ? exercise.left
            : exercise.right
      return { type: 'integer', value }
    }
    case 'column':
      return { type: 'integer', value: columnResult(exercise) }
    case 'fraction-read':
      return exercise.mode === 'read'
        ? { ...exercise.fraction, type: 'fraction', whole: 0 }
        : {
            ids: Array.from({ length: exercise.fraction.numerator }, (_, index) => index),
            type: 'selection',
          }
    case 'fraction-equal':
      return { type: 'integer', value: exercise.target[exercise.blank] }
    case 'fraction-pick':
      return { ids: equalOptionIndexes(exercise), type: 'selection' }
    case 'fraction-line':
      return exercise.mode === 'read'
        ? { ...exercise.target, type: 'fraction' }
        : { index: lineTickIndex(exercise), type: 'tick' }
    case 'fraction-compare':
      return { symbol: compareFractions(exercise.left, exercise.right), type: 'comparison' }
    case 'fraction-operation':
      return { ...fractionOperationResult(exercise), type: 'fraction', whole: 0 }
  }
}

const distinctIds = (ids: ReadonlyArray<number>): boolean => new Set(ids).size === ids.length

export const isExerciseAnswerCorrect = (exercise: Exercise, answer: PracticeAnswer): boolean => {
  const expected = expectedAnswer(exercise)
  if (exercise.kind === 'fraction-read' && exercise.mode === 'build') {
    return (
      answer.type === 'selection' &&
      distinctIds(answer.ids) &&
      answer.ids.every((id) => id < exercise.fraction.denominator) &&
      answer.ids.length === exercise.fraction.numerator
    )
  }
  if (expected.type === 'integer')
    return answer.type === 'integer' && answer.value === expected.value
  if (expected.type === 'fraction') {
    // Any equivalent fraction is right: the programme never asks CE2 learners to simplify.
    return answer.type === 'fraction' && sameValue(answer, expected)
  }
  if (expected.type === 'comparison') {
    return answer.type === 'comparison' && answer.symbol === expected.symbol
  }
  if (expected.type === 'tick') return answer.type === 'tick' && answer.index === expected.index
  return (
    answer.type === 'selection' &&
    distinctIds(answer.ids) &&
    answer.ids.length === expected.ids.length &&
    expected.ids.every((id) => answer.ids.includes(id))
  )
}

/** True when the learner produced the answer rather than recognising it among tiles. */
export const isProductionExercise = (exercise: Exercise): boolean => {
  switch (exercise.kind) {
    case 'column':
    case 'fraction-pick':
      return true
    case 'fraction-read':
      return exercise.mode === 'build' || exercise.choices.length === 0
    case 'fraction-line':
      return exercise.mode === 'place' || exercise.choices.length === 0
    case 'fraction-compare':
      return false
    default:
      return exercise.choices.length === 0
  }
}

const isFraction = (fraction: Fraction): boolean =>
  fraction.denominator >= 1 &&
  fraction.denominator <= MAX_DENOMINATOR &&
  fraction.numerator >= 0 &&
  fraction.numerator <= fraction.denominator

const denominatorsCompatible = (first: Fraction, second: Fraction): boolean =>
  first.denominator % second.denominator === 0 || second.denominator % first.denominator === 0

const arithmeticWellFormed = (exercise: ArithmeticExercise): boolean => {
  const { left, operation, right, skill } = exercise
  if ((operation === 'double' || operation === 'half') && exercise.blank !== 'result') return false
  if (operation === 'half' && left % 2 !== 0) return false
  if (operation === 'subtract' && right > left) return false
  const result = arithmeticResult(exercise)
  if (!Number.isInteger(result) || result < 0 || result > MAX_WHOLE_NUMBER) return false
  if (skill === 'addition-facts') {
    return operation === 'add' && left >= 1 && left <= 10 && right >= 1 && right <= 10
  }
  if (skill === 'subtraction-facts') {
    return operation === 'subtract' && left <= 20 && right >= 1 && right <= 10 && result <= 10
  }
  if (skill === 'near-ten') {
    return (operation === 'add' || operation === 'subtract') && [8, 9].includes(right % 10)
  }
  return true
}

export const isExerciseWellFormed = (exercise: Exercise): boolean => {
  switch (exercise.kind) {
    case 'arithmetic':
      return arithmeticWellFormed(exercise)
    case 'column': {
      const result = columnResult(exercise)
      if (exercise.skill === 'column-addition') {
        return exercise.operation === 'add' && result <= MAX_WHOLE_NUMBER
      }
      return exercise.operation === 'subtract' && exercise.terms.length === 2 && result >= 0
    }
    case 'fraction-read':
      return isFraction(exercise.fraction) && exercise.fraction.numerator >= 1
    case 'fraction-equal':
      return (
        isFraction(exercise.known) &&
        isFraction(exercise.target) &&
        exercise.known.denominator !== exercise.target.denominator &&
        denominatorsCompatible(exercise.known, exercise.target) &&
        sameValue(exercise.known, exercise.target)
      )
    case 'fraction-pick':
      return (
        isFraction(exercise.reference) &&
        exercise.options.every(isFraction) &&
        equalOptionIndexes(exercise).length >= 1
      )
    case 'fraction-line': {
      const { target, ticks, units } = exercise
      const position = target.whole + target.numerator / target.denominator
      return (
        target.numerator <= target.denominator &&
        position > 0 &&
        position <= units &&
        ticks <= MAX_DENOMINATOR &&
        ((target.whole * target.denominator + target.numerator) * ticks) % target.denominator === 0
      )
    }
    case 'fraction-compare':
      return (
        isFraction(exercise.left) &&
        isFraction(exercise.right) &&
        (exercise.left.denominator === exercise.right.denominator ||
          exercise.left.numerator === exercise.right.numerator ||
          denominatorsCompatible(exercise.left, exercise.right))
      )
    case 'fraction-operation': {
      if (!isFraction(exercise.left) || !isFraction(exercise.right)) return false
      if (!denominatorsCompatible(exercise.left, exercise.right)) return false
      const result = fractionOperationResult(exercise)
      return result.numerator >= 0 && result.numerator <= result.denominator
    }
  }
}

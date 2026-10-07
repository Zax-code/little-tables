/**
 * How exercises read: numbers and fractions in the child's language, spoken prompts for screen
 * readers, the statement shown after an answer and the names of skill levels. Ported from the
 * previous app; the answers come from the engine (`describeExercise`).
 */
import type {
  Exercise,
  ExerciseDescription,
  PracticeAnswer,
  Tense,
} from '@little-tables/engine/schema'

import type { Language } from '../data/schema.js'
import { createTranslator, type MessageKey, type MessageValues } from '../i18n/translator.js'

const translate = (locale: Language, key: MessageKey, values?: MessageValues) =>
  createTranslator(locale).t(key, values)

type Locale = Language

type FractionLike = Readonly<{ denominator: number; numerator: number; whole?: number | undefined }>

/** « connaître » as the catalogue writes it, in the 1990 spelling (« connaitre »). */
export const displayVerb = (verb: string): string =>
  verb === 'croître' ? verb : verb.replaceAll('î', 'i')

/** « au présent », « à l’imparfait »… (French in every language). */
export const tenseLabel = (tense: Tense, locale: Locale): string =>
  translate(locale, `conj.tense.${tense}`)

/** A subject and a form: « ils finissent », « j’aime ». */
export const withSubject = (subject: string, form: string): string =>
  subject.endsWith('’') || subject.endsWith("'") ? `${subject}${form}` : `${subject} ${form}`

/** Letters without their accents, to tell a missing accent from a spelling mistake. */
export const withoutAccents = (text: string): string =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** The child's answer as the engine compares it: one form, single spaces, composed accents. */
export const normalizeForm = (text: string): string =>
  text.normalize('NFC').trim().toLowerCase().replace(/[’ʼ`]/g, "'").replace(/\s+/g, ' ')

/** True when a wrong written form only lacks or misplaces accents (« alle » for « allé »). */
export const onlyAccentsDiffer = (answer: string, expected: string): boolean =>
  normalizeForm(answer) !== normalizeForm(expected) &&
  withoutAccents(normalizeForm(answer)) === withoutAccents(normalizeForm(expected))

const intlLocale = (locale: Locale): string => (locale === 'zh-Hans' ? 'zh-CN' : locale)

const numberFormats = new Map<Locale, Intl.NumberFormat>()

/** Groups thousands the way each language writes them: 4 500, 4,500. */
export const formatNumber = (value: number, locale: Locale): string => {
  let format = numberFormats.get(locale)
  if (format === undefined) {
    format = new Intl.NumberFormat(intlLocale(locale), {
      maximumFractionDigits: 0,
      useGrouping: true,
    })
    numberFormats.set(locale, format)
  }
  // Children read “1 000” more easily with a full no-break space than with the narrow one.
  return format.format(value).replace(/\u202f/g, '\u00a0')
}

export const formatFraction = (fraction: FractionLike): string => {
  const whole = fraction.whole ?? 0
  if (whole > 0 && fraction.numerator === 0) return String(whole)
  const part = `${fraction.numerator}/${fraction.denominator}`
  return whole > 0 ? `${whole} + ${part}` : part
}

const frenchNumbers = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
] as const
const englishNumbers = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
] as const
const chineseNumbers = [
  '零',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九',
  '十',
  '十一',
  '十二',
] as const

const frenchUnits: Readonly<Record<number, readonly [string, string]>> = {
  2: ['demi', 'demis'],
  3: ['tiers', 'tiers'],
  4: ['quart', 'quarts'],
  5: ['cinquième', 'cinquièmes'],
  6: ['sixième', 'sixièmes'],
  7: ['septième', 'septièmes'],
  8: ['huitième', 'huitièmes'],
  9: ['neuvième', 'neuvièmes'],
  10: ['dixième', 'dixièmes'],
  11: ['onzième', 'onzièmes'],
  12: ['douzième', 'douzièmes'],
}
const englishUnits: Readonly<Record<number, readonly [string, string]>> = {
  2: ['half', 'halves'],
  3: ['third', 'thirds'],
  4: ['quarter', 'quarters'],
  5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'],
  7: ['seventh', 'sevenths'],
  8: ['eighth', 'eighths'],
  9: ['ninth', 'ninths'],
  10: ['tenth', 'tenths'],
  11: ['eleventh', 'elevenths'],
  12: ['twelfth', 'twelfths'],
}

const numberWord = (value: number, locale: Locale): string => {
  const words = locale === 'fr' ? frenchNumbers : locale === 'en' ? englishNumbers : chineseNumbers
  return words[value] ?? String(value)
}

/** The plural name of a fraction unit, for headings such as “quarters” or “huitièmes”. */
export const fractionUnitName = (denominator: number, locale: Locale): string => {
  if (locale === 'zh-Hans') return `${numberWord(denominator, locale)}分之几`
  const units = locale === 'fr' ? frenchUnits : englishUnits
  return units[denominator]?.[1] ?? `1/${denominator}`
}

/** A fraction in words, used for every screen-reader label: “trois quarts”, “四分之三”. */
export const fractionInWords = (fraction: FractionLike, locale: Locale): string => {
  const whole = fraction.whole ?? 0
  const { denominator, numerator } = fraction
  if (locale === 'zh-Hans') {
    const part = `${numberWord(denominator, locale)}分之${numberWord(numerator, locale)}`
    if (whole === 0) return part
    return numerator === 0 ? numberWord(whole, locale) : `${numberWord(whole, locale)}又${part}`
  }
  const units = locale === 'fr' ? frenchUnits : englishUnits
  const [singular, plural] = units[denominator] ?? [`/${denominator}`, `/${denominator}`]
  const part =
    denominator === 1
      ? numberWord(numerator, locale)
      : `${numberWord(numerator, locale)} ${numerator === 1 ? singular : plural}`
  if (whole === 0) return part
  const wholeWords =
    locale === 'fr'
      ? whole === 1
        ? 'une unité'
        : `${numberWord(whole, locale)} unités`
      : numberWord(whole, locale)
  if (numerator === 0) return wholeWords
  return locale === 'fr' ? `${wholeWords} et ${part}` : `${wholeWords} and ${part}`
}

const operatorSymbol = (operation: 'add' | 'subtract'): string => (operation === 'add' ? '+' : '−')

export const formatAnswer = (answer: PracticeAnswer, locale: Locale): string => {
  switch (answer.type) {
    case 'integer':
      return formatNumber(answer.value, locale)
    case 'fraction':
      return formatFraction(answer)
    case 'comparison':
      return answer.symbol
    case 'text':
      return answer.value
    default:
      return ''
  }
}

const comparisonText = (
  exercise: Extract<Exercise, { kind: 'fraction-compare' }>,
  description: ExerciseDescription,
): string => {
  const answer = description.expected
  return `${formatFraction(exercise.left)} ${answer.type === 'comparison' ? answer.symbol : '?'} ${formatFraction(exercise.right)}`
}

/** A tile's spoken name: a number, a fraction in words or a comparison in words. */
export const answerWords = (answer: PracticeAnswer, locale: Locale): string => {
  if (answer.type === 'integer') return formatNumber(answer.value, locale)
  if (answer.type === 'fraction') return fractionInWords(answer, locale)
  if (answer.type === 'text') return answer.value
  if (answer.type === 'comparison') {
    return translate(
      locale,
      answer.symbol === '<'
        ? 'compare.smaller'
        : answer.symbol === '>'
          ? 'compare.larger'
          : 'compare.equal',
    )
  }
  return ''
}

/** The expected answer as short text, for “yes! …” and “almost — it’s …”. */
export const expectedAnswerText = (
  exercise: Exercise,
  description: ExerciseDescription,
  locale: Locale,
): string => {
  switch (exercise.kind) {
    case 'fraction-read':
      return formatFraction(exercise.fraction)
    case 'fraction-line':
      return formatFraction(exercise.target)
    case 'fraction-pick':
      return (description.equalOptions ?? [])
        .map((index) => formatFraction(exercise.options[index] ?? { denominator: 1, numerator: 0 }))
        .join(' · ')
    case 'fraction-compare':
      return comparisonText(exercise, description)
    default:
      return formatAnswer(description.expected, locale)
  }
}

/** True when a correct answer was written differently from the expected one, like 6/8 for 3/4. */
export const isEquivalentForm = (
  description: ExerciseDescription,
  response: PracticeAnswer,
): boolean => {
  const expected = description.expected
  if (expected.type === 'text' && response.type === 'text') {
    return normalizeForm(expected.value) !== normalizeForm(response.value)
  }
  return (
    expected.type === 'fraction' &&
    response.type === 'fraction' &&
    (expected.denominator !== response.denominator ||
      expected.numerator !== response.numerator ||
      expected.whole !== response.whole)
  )
}

/** The whole statement with its answer, shown under the feedback headline. */
export const exerciseStatement = (
  exercise: Exercise,
  description: ExerciseDescription,
  locale: Locale,
): string => {
  const number = (value: number) => formatNumber(value, locale)
  switch (exercise.kind) {
    case 'arithmetic': {
      const answer = description.expected
      const value = answer.type === 'integer' ? answer.value : 0
      if (exercise.operation === 'double') return `2 × ${number(exercise.left)} = ${number(value)}`
      if (exercise.operation === 'half') return `${number(exercise.left)} ÷ 2 = ${number(value)}`
      const result =
        exercise.blank === 'result'
          ? value
          : exercise.operation === 'add'
            ? exercise.left + exercise.right
            : exercise.left - exercise.right
      const left = exercise.blank === 'left' ? value : exercise.left
      const right = exercise.blank === 'right' ? value : exercise.right
      const operation = `${number(left)} ${operatorSymbol(exercise.operation)} ${number(right)}`
      return exercise.resultFirst
        ? `${number(result)} = ${operation}`
        : `${operation} = ${number(result)}`
    }
    case 'column': {
      const answer = description.expected
      const symbol = ` ${operatorSymbol(exercise.operation)} `
      return `${exercise.terms.map(number).join(symbol)} = ${number(answer.type === 'integer' ? answer.value : 0)}`
    }
    case 'fraction-read':
      return translate(locale, 'exercise.readSummary', {
        fraction: formatFraction(exercise.fraction),
      })
    case 'fraction-equal':
      return `${formatFraction(exercise.known)} = ${formatFraction(exercise.target)}`
    case 'fraction-pick':
      return [
        exercise.reference,
        ...(description.equalOptions ?? []).map((index) => exercise.options[index]),
      ]
        .flatMap((fraction) => (fraction === undefined ? [] : [formatFraction(fraction)]))
        .join(' = ')
    case 'fraction-line':
      return translate(locale, 'exercise.lineSteps', {
        count: description.tickIndex ?? 0,
        fraction: formatFraction(exercise.target),
        step: `1/${exercise.ticks}`,
      })
    case 'fraction-compare': {
      const answer = description.expected
      const symbol = answer.type === 'comparison' ? answer.symbol : '='
      return `${fractionInWords(exercise.left, locale)} ${translate(
        locale,
        symbol === '<' ? 'compare.smaller' : symbol === '>' ? 'compare.larger' : 'compare.equal',
      )} ${fractionInWords(exercise.right, locale)}`
    }
    case 'fraction-operation':
      return `${formatFraction(exercise.left)} ${operatorSymbol(exercise.operation)} ${formatFraction(exercise.right)} = ${formatFraction(description.operationResult ?? { denominator: 1, numerator: 0 })}`
    case 'conjugation':
      return withSubject(exercise.subject, exercise.expected)
  }
}

/** A fraction spoken digit by digit, with “how many” in place of a missing number. */
const spokenSlashFraction = (
  numerator: number | null,
  denominator: number | null,
  locale: Locale,
): string => {
  const blank = translate(locale, 'say.blank')
  const top = numerator === null ? blank : String(numerator)
  const bottom = denominator === null ? blank : String(denominator)
  return locale === 'zh-Hans'
    ? `${bottom}分之${top}`
    : translate(locale, 'say.over', { denominator: bottom, numerator: top })
}

/** What a screen reader announces for the question, before the learner answers. */
export const spokenPrompt = (exercise: Exercise, locale: Locale): string => {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values)
  const number = (value: number) => formatNumber(value, locale)
  const words = (fraction: FractionLike) => fractionInWords(fraction, locale)
  switch (exercise.kind) {
    case 'arithmetic': {
      if (exercise.operation === 'double') return t('say.double', { value: number(exercise.left) })
      if (exercise.operation === 'half') return t('say.half', { value: number(exercise.left) })
      const blank = t('say.blank')
      const result =
        exercise.operation === 'add'
          ? exercise.left + exercise.right
          : exercise.left - exercise.right
      const left = exercise.blank === 'left' ? blank : number(exercise.left)
      const right = exercise.blank === 'right' ? blank : number(exercise.right)
      const total = exercise.blank === 'result' ? blank : number(result)
      const operation = `${left} ${t(exercise.operation === 'add' ? 'say.plus' : 'say.minus')} ${right}`
      return exercise.resultFirst
        ? `${total} ${t('say.equals')} ${operation}`
        : `${operation} ${t('say.equals')} ${total}`
    }
    case 'column':
      return t('say.column', {
        operation: exercise.terms
          .map(number)
          .join(` ${t(exercise.operation === 'add' ? 'say.plus' : 'say.minus')} `),
      })
    case 'fraction-read':
      return exercise.mode === 'build'
        ? t('say.build', { fraction: words(exercise.fraction) })
        : t(exercise.shape === 'pot' ? 'say.readPot' : 'say.readBed', {
            filled: exercise.fraction.numerator,
            parts: exercise.fraction.denominator,
          })
    case 'fraction-equal': {
      const target =
        exercise.blank === 'numerator'
          ? spokenSlashFraction(null, exercise.target.denominator, locale)
          : spokenSlashFraction(exercise.target.numerator, null, locale)
      return t('say.equal', { known: words(exercise.known), target })
    }
    case 'fraction-pick':
      return t('say.pick', { fraction: words(exercise.reference) })
    case 'fraction-line':
      return exercise.mode === 'place'
        ? t('say.linePlace', { fraction: words(exercise.target) })
        : t('say.lineRead', { ticks: exercise.ticks, units: exercise.units })
    case 'fraction-compare':
      return t('say.compare', { left: words(exercise.left), right: words(exercise.right) })
    case 'fraction-operation':
      return `${words(exercise.left)} ${t(exercise.operation === 'add' ? 'say.plus' : 'say.minus')} ${words(exercise.right)} ${t('say.equals')} ${t('say.blank')}`
    case 'conjugation':
      return t('conj.say', {
        subject: exercise.subject.replace('’', 'e'),
        tense: tenseLabel(exercise.tense, locale),
        verb: displayVerb(exercise.verb),
      })
  }
}

/** A short, friendly name for a skill level, used in stats and celebration insights. */
export const levelLabel = (factKey: string, locale: Locale): string => {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values)
  const verb = /^conj:([^:]+):(present|imperfect|future|compound-past)$/.exec(factKey)
  if (verb !== null) {
    return t('conj.level', {
      tense: tenseLabel(verb[2] as Tense, locale),
      verb: displayVerb(verb[1] ?? ''),
    })
  }
  const addition = /^add:(\d+):(\d+)$/.exec(factKey)
  if (addition !== null) return `${addition[1]} + ${addition[2]}`
  const subtraction = /^sub:(\d+):(\d+)$/.exec(factKey)
  if (subtraction !== null) return `${subtraction[1]} − ${subtraction[2]}`
  const nearTen = /^nearten:(add|sub):(\d+)$/.exec(factKey)
  if (nearTen !== null) return `${nearTen[1] === 'add' ? '+' : '−'} ${nearTen[2]}`
  const numeration = /^numeration:([a-z0-9-]+)$/.exec(factKey)
  if (numeration !== null) {
    return t(`level.numeration.${numeration[1]}` as MessageKey)
  }
  const column = /^column:(add|sub):(.+)$/.exec(factKey)
  if (column !== null) {
    const [, operation = 'add', detail = ''] = column
    const base = t(operation === 'add' ? 'level.columnAdd' : 'level.columnSub')
    if (detail === '3-terms') return `${base} · ${t('level.threeTerms')}`
    if (detail === 'zero') return `${base} · ${t('level.zeros')}`
    const [digits = '2', exchanges = ''] = detail.split(':')
    const count = exchanges.split('-')[1] ?? '0'
    const exchangeLabel =
      count === '0'
        ? t('level.noCarry')
        : count === '1'
          ? t('level.oneCarry')
          : count === '2'
            ? t('level.twoCarries')
            : t('level.manyCarries')
    return `${base} · ${t('level.digits', { count: digits.replace('d', '') })} · ${exchangeLabel}`
  }
  const read = /^frac:read:(\d+)$/.exec(factKey)
  if (read !== null) return t('level.read', { unit: fractionUnitName(Number(read[1]), locale) })
  const equal = /^frac:equal:(\d+)-(\d+)$/.exec(factKey)
  if (equal !== null) {
    return t('level.equal', {
      large: fractionUnitName(Number(equal[2]), locale),
      small: fractionUnitName(Number(equal[1]), locale),
    })
  }
  const line = /^frac:line:(\w+)$/.exec(factKey)
  if (line !== null) {
    return line[1] === 'mixed'
      ? t('level.lineMixed')
      : t('level.line', { unit: fractionUnitName(Number(line[1]), locale) })
  }
  const compare = /^frac:compare:([a-z-]+)$/.exec(factKey)
  if (compare !== null) return t(`level.compare.${compare[1]}` as MessageKey)
  const operation = /^frac:(add|sub|complement)(?::([a-z-]+))?$/.exec(factKey)
  if (operation !== null) {
    if (operation[1] === 'complement') return t('level.complement')
    return t(
      `level.${operation[1] === 'add' ? 'fractionAdd' : 'fractionSub'}.${operation[2] ?? 'same-d'}` as Parameters<
        typeof translate
      >[1],
    )
  }
  return factKey
}

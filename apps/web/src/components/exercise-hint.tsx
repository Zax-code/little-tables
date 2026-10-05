import {
  compareFractions,
  equalOptionIndexes,
  fractionOperationResult,
  lineTickIndex,
  type Exercise,
  type Fraction,
  type SubtractionMethod,
} from '@little-tables/domain'

import type { ReactNode } from 'react'

import { columnSteps, digitAt } from '../column-math.js'
import {
  formatFraction,
  formatNumber,
  fractionInWords,
  fractionUnitName,
} from '../exercise-format.js'
import { useI18n } from '../i18n.js'
import { GardenBed } from './fraction-figure.js'
import { filledParts } from '../fraction-layout.js'
import { FractionRuler } from './fraction-ruler.js'

type Translator = ReturnType<typeof useI18n>['t']
type Locale = ReturnType<typeof useI18n>['locale']

const placeKeys = [
  'place.units',
  'place.tens',
  'place.hundreds',
  'place.thousands',
  'place.tenThousands',
] as const

function HintFrame({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
  const { t } = useI18n()
  return (
    <div className="fact-rescue exercise-hint">
      <header>
        <span>{t('rescue.heading')}</span>
        <strong>{label}</strong>
      </header>
      {children}
      <p className="hint-revisit">{t('rescue.revisit')}</p>
    </div>
  )
}

function TenFrames({ first, second }: Readonly<{ first: number; second: number }>) {
  const total = first + second
  const frames = Math.max(1, Math.ceil(total / 10))
  return (
    <div aria-hidden="true" className="ten-frames">
      {Array.from({ length: frames }, (_, frame) => (
        <div className="ten-frame" key={frame}>
          {Array.from({ length: 10 }, (_, cell) => {
            const index = frame * 10 + cell
            return (
              <i
                className={index < first ? 'is-first' : index < total ? 'is-second' : ''}
                key={cell}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

const blockCounts = (value: number) => ({
  hundreds: Math.floor((value % 1000) / 100),
  ones: value % 10,
  tens: Math.floor((value % 100) / 10),
  thousands: Math.floor(value / 1000),
})

function BaseTenBlocks({ value }: Readonly<{ value: number }>) {
  const counts = blockCounts(value)
  return (
    <div aria-hidden="true" className="base-ten">
      {Array.from({ length: Math.min(counts.thousands, 10) }, (_, index) => (
        <i className="block-thousand" key={`m${index}`} />
      ))}
      {Array.from({ length: counts.hundreds }, (_, index) => (
        <i className="block-hundred" key={`c${index}`} />
      ))}
      {Array.from({ length: counts.tens }, (_, index) => (
        <i className="block-ten" key={`d${index}`} />
      ))}
      {Array.from({ length: counts.ones }, (_, index) => (
        <i className="block-one" key={`u${index}`} />
      ))}
    </div>
  )
}

const decomposition = (value: number, t: Translator): string => {
  const counts = blockCounts(value)
  return [
    counts.thousands > 0 ? t('blocks.thousands', { count: counts.thousands }) : null,
    counts.hundreds > 0 ? t('blocks.hundreds', { count: counts.hundreds }) : null,
    counts.tens > 0 ? t('blocks.tens', { count: counts.tens }) : null,
    counts.ones > 0 ? t('blocks.ones', { count: counts.ones }) : null,
  ]
    .filter((part) => part !== null)
    .join(', ')
}

function ArithmeticHint({
  exercise,
}: Readonly<{ exercise: Extract<Exercise, { kind: 'arithmetic' }> }>) {
  const { locale, t } = useI18n()
  const number = (value: number) => formatNumber(value, locale)
  const { left, operation, right } = exercise
  if (operation === 'double' || operation === 'half') {
    const result = operation === 'double' ? left * 2 : left / 2
    return (
      <HintFrame label={t('hint.doubleLabel')}>
        <BaseTenBlocks value={operation === 'double' ? left : result} />
        <p>
          {t(operation === 'double' ? 'hint.double' : 'hint.half', {
            result: number(result),
            value: number(left),
          })}
        </p>
      </HintFrame>
    )
  }
  const total = operation === 'add' ? left + right : left - right
  if (exercise.skill === 'addition-facts') {
    const big = Math.max(left, right)
    const small = Math.min(left, right)
    const need = 10 - big
    if (big !== small && big - small === 1) {
      return (
        <HintFrame label={t('hint.nearDoubleLabel')}>
          <TenFrames first={small} second={big} />
          <p>{t('hint.nearDouble', { big, double: small * 2, small, total: left + right })}</p>
        </HintFrame>
      )
    }
    if (left + right > 10 && need > 0) {
      return (
        <HintFrame label={t('hint.makeTenLabel')}>
          <TenFrames first={big} second={small} />
          <p>{t('hint.makeTen', { big, need, rest: small - need, small, total: left + right })}</p>
        </HintFrame>
      )
    }
    return (
      <HintFrame label={t('hint.countOnLabel')}>
        <TenFrames first={big} second={small} />
        <p>{t('hint.countOn', { big, small, total: left + right })}</p>
      </HintFrame>
    )
  }
  if (exercise.skill === 'subtraction-facts') {
    return (
      <HintFrame label={t('hint.familyLabel')}>
        <TenFrames first={total} second={right} />
        <p>{t('hint.family', { part: right, rest: total, total: left })}</p>
      </HintFrame>
    )
  }
  if (exercise.skill === 'near-ten') {
    const round = right % 10 === 9 ? right + 1 : right + 2
    const adjust = round - right
    const middle = operation === 'add' ? left + round : left - round
    return (
      <HintFrame label={t('hint.nearTenLabel')}>
        <div aria-hidden="true" className="hop-row">
          <span>{number(left)}</span>
          <i>{`${operation === 'add' ? '+' : '−'} ${round}`}</i>
          <span>{number(middle)}</span>
          <i>{`${operation === 'add' ? '−' : '+'} ${adjust}`}</i>
          <span className="is-result">{number(total)}</span>
        </div>
        <p>
          {t(operation === 'add' ? 'hint.nearTenAdd' : 'hint.nearTenSubtract', {
            adjust,
            amount: right,
            left: number(left),
            middle: number(middle),
            result: number(total),
            round,
          })}
        </p>
      </HintFrame>
    )
  }
  if (exercise.blank !== 'result') {
    const from = exercise.blank === 'right' ? left : right
    return (
      <HintFrame label={t('hint.missingLabel')}>
        <BaseTenBlocks value={from} />
        <p>
          {t('hint.missing', {
            answer: number(exercise.blank === 'right' ? right : left),
            from: number(from),
            to: number(total),
          })}
        </p>
      </HintFrame>
    )
  }
  return (
    <HintFrame label={t('hint.blocksLabel')}>
      <div className="hint-blocks-pair">
        <BaseTenBlocks value={left} />
        <BaseTenBlocks value={right} />
      </div>
      <p>
        {t(operation === 'add' ? 'hint.blocksAdd' : 'hint.blocksSubtract', {
          left: number(left),
          leftParts: decomposition(left, t),
          result: number(total),
          right: number(right),
          rightParts: decomposition(right, t),
        })}
      </p>
    </HintFrame>
  )
}

function ColumnHint({
  exercise,
  method,
  wrongColumn,
}: Readonly<{
  exercise: Extract<Exercise, { kind: 'column' }>
  method: SubtractionMethod
  wrongColumn: number | null
}>) {
  const { t } = useI18n()
  const steps = columnSteps(exercise)
  const step =
    steps.find(({ column }) => column === wrongColumn) ??
    steps.find(({ exchange }) => exchange) ??
    steps[0]
  if (step === undefined) return null
  const place = t(placeKeys[step.column] ?? 'place.units')
  const next = t(placeKeys[step.column + 1] ?? 'place.tens')
  if (exercise.operation === 'add') {
    const digits = exercise.terms.map((term) => Number(digitAt(term, step.column) || 0))
    const sum = `${digits.join(' + ')}${step.incoming > 0 ? ` + ${step.incoming}` : ''}`
    return (
      <HintFrame label={t('hint.columnLabel')}>
        <p>
          {step.exchange
            ? t('hint.columnCarry', {
                carry: Math.floor(step.top / 10),
                next,
                place,
                sum,
                total: step.top,
                write: step.top % 10,
              })
            : t('hint.columnSimple', { place, sum, total: step.top })}
        </p>
      </HintFrame>
    )
  }
  const bottom = method === 'compensation' ? step.bottom + step.incoming : step.bottom
  const top = method === 'compensation' ? step.top : step.top - step.incoming
  const shown = `${top} − ${bottom}`
  if (!step.exchange) {
    return (
      <HintFrame label={t('hint.columnLabel')}>
        <p>{t('hint.columnSimple', { place, sum: shown, total: top - bottom })}</p>
      </HintFrame>
    )
  }
  return (
    <HintFrame
      label={t(method === 'compensation' ? 'hint.compensationLabel' : 'hint.decompositionLabel')}
    >
      <p>
        {t(method === 'compensation' ? 'hint.compensation' : 'hint.decomposition', {
          bigger: top + 10,
          bottom,
          next,
          place,
          result: top + 10 - bottom,
          sum: shown,
        })}
      </p>
    </HintFrame>
  )
}

function BedWithCaption({
  caption,
  fraction,
  tone,
}: Readonly<{ caption: string; fraction: Fraction; tone?: 'gold' | 'lavender' | 'pink' }>) {
  const { locale, t } = useI18n()
  return (
    <figure className="hint-bed">
      <GardenBed
        compact
        denominator={fraction.denominator}
        filled={filledParts(fraction.denominator, fraction.numerator)}
        label={t('figure.bedLabel', { filled: fraction.numerator, parts: fraction.denominator })}
        {...(tone === undefined ? {} : { tone })}
      />
      <figcaption>
        <b>{caption}</b> <span>{fractionInWords(fraction, locale)}</span>
      </figcaption>
    </figure>
  )
}

const unitName = (fraction: Fraction, locale: Locale) =>
  fractionUnitName(fraction.denominator, locale)

function FractionHint({ exercise }: Readonly<{ exercise: Exercise }>) {
  const { locale, t } = useI18n()
  switch (exercise.kind) {
    case 'fraction-read':
      return (
        <HintFrame label={t('hint.readLabel')}>
          <BedWithCaption
            caption={formatFraction(exercise.fraction)}
            fraction={exercise.fraction}
          />
          <p>
            {t('hint.read', {
              filled: exercise.fraction.numerator,
              fraction: formatFraction(exercise.fraction),
              parts: exercise.fraction.denominator,
            })}
          </p>
        </HintFrame>
      )
    case 'fraction-equal':
    case 'fraction-pick': {
      const first = exercise.kind === 'fraction-equal' ? exercise.known : exercise.reference
      const second =
        exercise.kind === 'fraction-equal'
          ? exercise.target
          : (exercise.options[equalOptionIndexes(exercise)[0] ?? 0] ?? exercise.reference)
      const small = first.denominator < second.denominator ? first : second
      const large = small === first ? second : first
      return (
        <HintFrame label={t('hint.equalLabel')}>
          <BedWithCaption caption={formatFraction(small)} fraction={small} />
          <BedWithCaption caption={formatFraction(large)} fraction={large} tone="lavender" />
          <p>
            {t('hint.equal', {
              large: formatFraction(large),
              scale: large.denominator / small.denominator,
              small: formatFraction(small),
            })}
          </p>
        </HintFrame>
      )
    }
    case 'fraction-line':
      return (
        <HintFrame label={t('hint.lineLabel')}>
          <FractionRuler
            ladybug={lineTickIndex(exercise)}
            reveal={{ index: lineTickIndex(exercise), label: formatFraction(exercise.target) }}
            ticks={exercise.ticks}
            units={exercise.units}
          />
          <p>
            {t('hint.line', {
              fraction: formatFraction(exercise.target),
              step: `1/${exercise.ticks}`,
              ticks: exercise.ticks,
            })}
          </p>
        </HintFrame>
      )
    case 'fraction-compare': {
      const symbol = compareFractions(exercise.left, exercise.right)
      const key =
        exercise.left.denominator === exercise.right.denominator
          ? 'hint.compareSameDenominator'
          : exercise.left.numerator === exercise.right.numerator
            ? 'hint.compareSameNumerator'
            : 'hint.compareMultiple'
      return (
        <HintFrame label={t('hint.compareLabel')}>
          <BedWithCaption caption={formatFraction(exercise.left)} fraction={exercise.left} />
          <BedWithCaption
            caption={formatFraction(exercise.right)}
            fraction={exercise.right}
            tone="lavender"
          />
          <p>
            {t(key, {
              answer: `${formatFraction(exercise.left)} ${symbol} ${formatFraction(exercise.right)}`,
            })}
          </p>
        </HintFrame>
      )
    }
    case 'fraction-operation': {
      const result = fractionOperationResult(exercise)
      const denominator = result.denominator
      const scale = (fraction: Fraction): Fraction => ({
        denominator,
        numerator: fraction.numerator * (denominator / fraction.denominator),
      })
      const left = scale(exercise.left)
      const right = scale(exercise.right)
      const converted = [exercise.left, exercise.right].find(
        (fraction) => fraction.denominator !== denominator,
      )
      return (
        <HintFrame label={t('hint.operationLabel')}>
          <BedWithCaption caption={formatFraction(left)} fraction={left} />
          <BedWithCaption caption={formatFraction(right)} fraction={right} tone="lavender" />
          {converted === undefined ? null : (
            <p>
              {t('hint.operationConvert', {
                from: formatFraction(converted),
                to: formatFraction(scale(converted)),
              })}
            </p>
          )}
          <p>
            {t(exercise.operation === 'add' ? 'hint.operationAdd' : 'hint.operationSubtract', {
              left: left.numerator,
              result: formatFraction(result),
              right: right.numerator,
              unit: unitName(result, locale),
            })}
          </p>
        </HintFrame>
      )
    }
    default:
      return null
  }
}

type ExerciseHintProps = Readonly<{
  exercise: Exercise
  method: SubtractionMethod
  wrongColumn: number | null
}>

/** A gentle, skill-specific explanation shown after a miss, only when the learner asks. */
export function ExerciseHint({ exercise, method, wrongColumn }: ExerciseHintProps) {
  if (exercise.kind === 'arithmetic') return <ArithmeticHint exercise={exercise} />
  if (exercise.kind === 'column') {
    return <ColumnHint exercise={exercise} method={method} wrongColumn={wrongColumn} />
  }
  return <FractionHint exercise={exercise} />
}

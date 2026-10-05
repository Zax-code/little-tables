/**
 * Help after a miss (mockup C4): another way to see a multiplication, or an explanation fitted
 * to the exercise. The child asks for it; it is never forced.
 */
import type {
  Exercise,
  ExerciseDescription,
  Fraction,
  LearningPathSettings,
  PracticeQuestion,
  RescueStrategy,
} from '@little-tables/engine/schema'
import { Button } from '@little-tables/ui'
import { useState, type ReactNode, type SyntheticEvent } from 'react'

import { useI18n } from '../i18n/i18n.js'
import type { MessageKey, Translator } from '../i18n/translator.js'
import { columnSteps, digitAt, placeKeys } from './column-entry.js'
import { GardenBed } from './figures.js'
import { filledParts } from './fraction-figures.js'
import { formatFraction, formatNumber, fractionInWords, fractionUnitName } from './format.js'
import { RulerDrawing } from './ruler.js'

type SubtractionMethod = LearningPathSettings['subtractionMethod']

function HintCard({
  actions,
  children,
  label,
}: Readonly<{ actions?: ReactNode; children: ReactNode; label: string }>) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 text-left">
      <h3 className="text-body font-extrabold">{label}</h3>
      <div className="flex flex-col gap-2.5 text-subhead text-label-2">{children}</div>
      {actions}
    </section>
  )
}

/* Multiplications and divisions ---------------------------------------------------------------- */

const strategyLabel = (
  strategy: RescueStrategy | undefined,
  question: PracticeQuestion,
  t: Translator['t'],
) =>
  question.operation === 'divide'
    ? t('rescue.divisionLabel')
    : strategy?.kind === 'commutative-flip'
      ? t('rescue.flipLabel')
      : strategy?.kind === 'known-fact-bridge'
        ? t('rescue.bridgeLabel')
        : t('rescue.arrayLabel')

function Strategy({ strategy }: Readonly<{ strategy: RescueStrategy }>) {
  const { t } = useI18n()
  if (strategy.kind === 'array') {
    return (
      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="grid shrink-0 gap-1"
          style={{ gridTemplateColumns: `repeat(${strategy.columns}, 0.6rem)` }}
        >
          {Array.from({ length: strategy.total }, (_, index) => (
            <i className="size-2.5 rounded-full bg-tint" key={index} />
          ))}
        </div>
        <p>
          {t('rescue.array', {
            answer: strategy.total,
            left: strategy.rows,
            right: strategy.columns,
          })}
        </p>
      </div>
    )
  }
  if (strategy.kind === 'commutative-flip') {
    return <p>{t('rescue.flip', { left: strategy.left, right: strategy.right })}</p>
  }
  const one = strategy.adjustment.factor === 1
  const key: MessageKey =
    strategy.operator === 'subtract'
      ? one
        ? 'rescue.bridgeSubtractOne'
        : 'rescue.bridgeSubtractMany'
      : one
        ? 'rescue.bridgeOne'
        : 'rescue.bridgeMany'
  return (
    <p>
      {t(key, {
        answer: strategy.total,
        extraLeft: strategy.adjustment.factor,
        knownAnswer: strategy.anchor.product,
        knownLeft: strategy.anchor.factor,
        right: strategy.commonFactor,
      })}
    </p>
  )
}

type FactRescueProps = Readonly<{
  answer: number
  question: PracticeQuestion
  strategies: ReadonlyArray<RescueStrategy>
}>

/** Another way to see the fact, then a quiet try that is not recorded. */
export function FactRescue({ answer, question, strategies }: FactRescueProps) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [trying, setTrying] = useState(false)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<'right' | 'wrong' | null>(null)
  const strategy = strategies[index]
  const symbol = question.operation === 'divide' ? '÷' : '×'
  const asked = `${question.left} ${symbol} ${question.right}`

  if (trying) {
    const check = (event: SyntheticEvent) => {
      event.preventDefault()
      setResult(Number(value) === answer ? 'right' : 'wrong')
    }
    return (
      <HintCard label={t('rescue.try')}>
        {result === 'right' ? (
          <p className="font-extrabold text-leaf" role="status">
            {t('session.bubbleYes', { answer })} {t('rescue.revisit')}
          </p>
        ) : (
          <form className="flex items-center gap-2" onSubmit={check}>
            <span aria-hidden className="text-title-2 font-black text-label">
              {asked} =
            </span>
            <input
              aria-label={t('rescue.tryLabel', { question: asked })}
              autoComplete="off"
              className="h-12 w-20 rounded-control border-2 border-tint bg-surface text-center text-title-2 font-black text-label outline-none"
              inputMode="numeric"
              onChange={(event) => {
                setResult(null)
                setValue(event.target.value.replace(/\D/g, '').slice(0, 3))
              }}
              pattern="[0-9]*"
              value={value}
            />
            <Button disabled={value === ''} size="sm" type="submit">
              {t('rescue.check')}
            </Button>
          </form>
        )}
        {result === 'wrong' ? (
          <p className="font-bold text-sun" role="status">
            {t('rescue.tryAgain', { answer })}
          </p>
        ) : null}
      </HintCard>
    )
  }

  const total = question.operation === 'multiply' ? answer : question.left
  const quotient = question.operation === 'multiply' ? question.left : answer
  return (
    <HintCard
      actions={
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={strategies.length < 2}
            onClick={() => setIndex((current) => (current + 1) % Math.max(1, strategies.length))}
            size="sm"
            variant="tinted"
          >
            {t('rescue.another')}
          </Button>
          <Button onClick={() => setTrying(true)} size="sm" variant="tinted">
            {t('rescue.try')}
          </Button>
        </div>
      }
      label={strategyLabel(strategy, question, t)}
    >
      {strategy === undefined || question.operation === 'divide' ? (
        <>
          <p>
            {t('rescue.divisionFamily', { answer: total, left: question.right, right: quotient })}
          </p>
          <p className="font-bold text-label">
            {t('rescue.divisionGroups', { answer: total, left: question.right })}
          </p>
        </>
      ) : (
        <Strategy strategy={strategy} />
      )}
    </HintCard>
  )
}

/* Learning-path exercises ---------------------------------------------------------------------- */

function TenFrames({ first, second }: Readonly<{ first: number; second: number }>) {
  const total = first + second
  return (
    <div aria-hidden className="flex flex-wrap gap-2">
      {Array.from({ length: Math.max(1, Math.ceil(total / 10)) }, (_, frame) => (
        <div className="grid grid-cols-5 gap-1 rounded-lg bg-surface-2 p-1.5" key={frame}>
          {Array.from({ length: 10 }, (_, cell) => {
            const index = frame * 10 + cell
            return (
              <i
                className={`size-3.5 rounded-full ${index < first ? 'bg-tint' : index < total ? 'bg-sky' : 'bg-separator'}`}
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

const blocks = (count: number, className: string, prefix: string) =>
  Array.from({ length: count }, (_, index) => <i className={className} key={`${prefix}${index}`} />)

function BaseTenBlocks({ value }: Readonly<{ value: number }>) {
  const counts = blockCounts(value)
  return (
    <div aria-hidden className="flex flex-wrap items-end gap-1">
      {blocks(Math.min(counts.thousands, 10), 'size-7 rounded-sm bg-sun', 'm')}
      {blocks(counts.hundreds, 'size-5 rounded-sm bg-tint', 'c')}
      {blocks(counts.tens, 'h-5 w-1.5 rounded-sm bg-sky', 'd')}
      {blocks(counts.ones, 'size-1.5 rounded-sm bg-leaf', 'u')}
    </div>
  )
}

const decomposition = (value: number, t: Translator['t']) => {
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
  const { language, t } = useI18n()
  const number = (value: number) => formatNumber(value, language)
  const { left, operation, right } = exercise
  if (operation === 'double' || operation === 'half') {
    const result = operation === 'double' ? left * 2 : left / 2
    return (
      <HintCard label={t('hint.doubleLabel')}>
        <BaseTenBlocks value={operation === 'double' ? left : result} />
        <p>
          {t(operation === 'double' ? 'hint.double' : 'hint.half', {
            result: number(result),
            value: number(left),
          })}
        </p>
      </HintCard>
    )
  }
  const total = operation === 'add' ? left + right : left - right
  if (exercise.skill === 'addition-facts') {
    const big = Math.max(left, right)
    const small = Math.min(left, right)
    const need = 10 - big
    if (big !== small && big - small === 1) {
      return (
        <HintCard label={t('hint.nearDoubleLabel')}>
          <TenFrames first={small} second={big} />
          <p>{t('hint.nearDouble', { big, double: small * 2, small, total: left + right })}</p>
        </HintCard>
      )
    }
    if (left + right > 10 && need > 0) {
      return (
        <HintCard label={t('hint.makeTenLabel')}>
          <TenFrames first={big} second={small} />
          <p>{t('hint.makeTen', { big, need, rest: small - need, small, total: left + right })}</p>
        </HintCard>
      )
    }
    return (
      <HintCard label={t('hint.countOnLabel')}>
        <TenFrames first={big} second={small} />
        <p>{t('hint.countOn', { big, small, total: left + right })}</p>
      </HintCard>
    )
  }
  if (exercise.skill === 'subtraction-facts') {
    return (
      <HintCard label={t('hint.familyLabel')}>
        <TenFrames first={total} second={right} />
        <p>{t('hint.family', { part: right, rest: total, total: left })}</p>
      </HintCard>
    )
  }
  if (exercise.skill === 'near-ten') {
    const round = right % 10 === 9 ? right + 1 : right + 2
    const adjust = round - right
    const middle = operation === 'add' ? left + round : left - round
    return (
      <HintCard label={t('hint.nearTenLabel')}>
        <p aria-hidden className="flex flex-wrap items-center gap-2 font-black text-label">
          <span>{number(left)}</span>
          <span className="text-tint">{`${operation === 'add' ? '+' : '−'} ${round}`}</span>
          <span>{number(middle)}</span>
          <span className="text-tint">{`${operation === 'add' ? '−' : '+'} ${adjust}`}</span>
          <span className="text-leaf">{number(total)}</span>
        </p>
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
      </HintCard>
    )
  }
  if (exercise.blank !== 'result') {
    const from = exercise.blank === 'right' ? left : right
    return (
      <HintCard label={t('hint.missingLabel')}>
        <BaseTenBlocks value={from} />
        <p>
          {t('hint.missing', {
            answer: number(exercise.blank === 'right' ? right : left),
            from: number(from),
            to: number(total),
          })}
        </p>
      </HintCard>
    )
  }
  return (
    <HintCard label={t('hint.blocksLabel')}>
      <div className="flex flex-col gap-2">
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
    </HintCard>
  )
}

type ColumnHintProps = Readonly<{
  exercise: Extract<Exercise, { kind: 'column' }>
  method: SubtractionMethod
  wrongColumn: number | null
}>

function ColumnHint({ exercise, method, wrongColumn }: ColumnHintProps) {
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
      <HintCard label={t('hint.columnLabel')}>
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
      </HintCard>
    )
  }
  const bottom = method === 'compensation' ? step.bottom + step.incoming : step.bottom
  const top = method === 'compensation' ? step.top : step.top - step.incoming
  const shown = `${top} − ${bottom}`
  if (!step.exchange) {
    return (
      <HintCard label={t('hint.columnLabel')}>
        <p>{t('hint.columnSimple', { place, sum: shown, total: top - bottom })}</p>
      </HintCard>
    )
  }
  return (
    <HintCard
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
    </HintCard>
  )
}

function BedWithCaption({
  caption,
  fraction,
  tone,
}: Readonly<{ caption: string; fraction: Fraction; tone?: 'lavender' | 'pink' }>) {
  const { language, t } = useI18n()
  return (
    <figure className="flex flex-col gap-1">
      <GardenBed
        compact
        denominator={fraction.denominator}
        filled={filledParts(fraction.denominator, fraction.numerator)}
        label={t('figure.bedLabel', { filled: fraction.numerator, parts: fraction.denominator })}
        {...(tone === undefined ? {} : { tone })}
      />
      <figcaption className="text-footnote">
        <b className="text-label">{caption}</b> {fractionInWords(fraction, language)}
      </figcaption>
    </figure>
  )
}

function FractionHint({
  description,
  exercise,
}: Readonly<{ description: ExerciseDescription; exercise: Exercise }>) {
  const { language, t } = useI18n()
  switch (exercise.kind) {
    case 'fraction-read':
      return (
        <HintCard label={t('hint.readLabel')}>
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
        </HintCard>
      )
    case 'fraction-equal':
    case 'fraction-pick': {
      const first = exercise.kind === 'fraction-equal' ? exercise.known : exercise.reference
      const second =
        exercise.kind === 'fraction-equal'
          ? exercise.target
          : (exercise.options[description.equalOptions?.[0] ?? 0] ?? exercise.reference)
      const small = first.denominator < second.denominator ? first : second
      const large = small === first ? second : first
      return (
        <HintCard label={t('hint.equalLabel')}>
          <BedWithCaption caption={formatFraction(small)} fraction={small} />
          <BedWithCaption caption={formatFraction(large)} fraction={large} tone="lavender" />
          <p>
            {t('hint.equal', {
              large: formatFraction(large),
              scale: large.denominator / small.denominator,
              small: formatFraction(small),
            })}
          </p>
        </HintCard>
      )
    }
    case 'fraction-line': {
      const index = description.tickIndex ?? 0
      return (
        <HintCard label={t('hint.lineLabel')}>
          <RulerDrawing
            ladybug={index}
            reveal={{ index, label: formatFraction(exercise.target) }}
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
        </HintCard>
      )
    }
    case 'fraction-compare': {
      const symbol = description.expected.type === 'comparison' ? description.expected.symbol : '='
      const key: MessageKey =
        exercise.left.denominator === exercise.right.denominator
          ? 'hint.compareSameDenominator'
          : exercise.left.numerator === exercise.right.numerator
            ? 'hint.compareSameNumerator'
            : 'hint.compareMultiple'
      return (
        <HintCard label={t('hint.compareLabel')}>
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
        </HintCard>
      )
    }
    case 'fraction-operation': {
      const result = description.operationResult ?? { denominator: 1, numerator: 0 }
      const scale = (fraction: Fraction): Fraction => ({
        denominator: result.denominator,
        numerator: fraction.numerator * (result.denominator / fraction.denominator),
      })
      const left = scale(exercise.left)
      const right = scale(exercise.right)
      const converted = [exercise.left, exercise.right].find(
        (fraction) => fraction.denominator !== result.denominator,
      )
      return (
        <HintCard label={t('hint.operationLabel')}>
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
              unit: fractionUnitName(result.denominator, language),
            })}
          </p>
        </HintCard>
      )
    }
    default:
      return null
  }
}

type ExerciseHintProps = Readonly<{
  description: ExerciseDescription
  exercise: Exercise
  method: SubtractionMethod
  wrongColumn: number | null
}>

/** A gentle explanation fitted to the skill; the exercise will come back later. */
export function ExerciseHint({ description, exercise, method, wrongColumn }: ExerciseHintProps) {
  const { t } = useI18n()
  const hint =
    exercise.kind === 'arithmetic' ? (
      <ArithmeticHint exercise={exercise} />
    ) : exercise.kind === 'column' ? (
      <ColumnHint exercise={exercise} method={method} wrongColumn={wrongColumn} />
    ) : (
      <FractionHint description={description} exercise={exercise} />
    )
  return (
    <div className="flex flex-col gap-2">
      {hint}
      <p className="px-1 text-footnote font-semibold text-label-2">{t('rescue.revisit')}</p>
    </div>
  )
}

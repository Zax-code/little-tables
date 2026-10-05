/** Answer controls of the panel: the fraction pad, answer tiles and multiple choices. */
import type { Fraction, PracticeAnswer } from '@little-tables/engine/schema'
import {
  AnswerTiles,
  Button,
  cn,
  FractionText,
  NumberPad,
  type PadKey,
  type TileState,
} from '@little-tables/ui'
import { Check } from 'lucide-react'
import { useState } from 'react'

import { useI18n } from '../i18n/i18n.js'
import { answerWords, formatNumber, fractionInWords } from './format.js'

/** A typed whole number, at most `maxDigits` long. */
export function useTypedNumber(maxDigits: number) {
  const [value, setValue] = useState('')
  return {
    clear: () => setValue(''),
    press: (key: Exclude<PadKey, 'submit'>) =>
      setValue((current) =>
        key === 'erase'
          ? current.slice(0, -1)
          : current.length >= maxDigits
            ? current
            : current === '0'
              ? key
              : `${current}${key}`,
      ),
    value,
  }
}

type DigitsPadProps = Readonly<{
  canSubmit: boolean
  disabled: boolean
  onDigit: (key: Exclude<PadKey, 'submit'>) => void
  onSubmit: () => void
  submitLabel?: string
}>

/** The single keypad of every typed answer. */
export function DigitsPad({ canSubmit, disabled, onDigit, onSubmit, submitLabel }: DigitsPadProps) {
  const { t } = useI18n()
  return (
    <div className={cn(disabled && 'pointer-events-none opacity-60')}>
      <NumberPad
        eraseLabel={t('session.erase')}
        label={t('session.keypad')}
        onKey={(key) => (key === 'submit' ? onSubmit() : onDigit(key))}
        submitDisabled={!canSubmit || disabled}
        submitLabel={submitLabel ?? t('session.submit')}
      />
    </div>
  )
}

type Slot = 'denominator' | 'numerator'

type FractionPadProps = Readonly<{
  disabled: boolean
  onSubmit: (answer: PracticeAnswer) => void
  /** Offer whole units (0, 1 +, 2 +) for rulers longer than one unit. */
  withWhole: boolean
}>

/**
 * Numerator over denominator: digits go to the highlighted box; ✓ first moves to the
 * denominator, then answers. Either box can be chosen by tapping it.
 */
export function FractionPad({ disabled, onSubmit, withWhole }: FractionPadProps) {
  const translator = useI18n()
  const { t } = translator
  const [whole, setWhole] = useState(0)
  const [numerator, setNumerator] = useState('')
  const [denominator, setDenominator] = useState('')
  const [slot, setSlot] = useState<Slot>('numerator')
  const complete = numerator !== '' && denominator !== '' && Number(denominator) > 0
  const value = slot === 'numerator' ? numerator : denominator
  const setValue = slot === 'numerator' ? setNumerator : setDenominator
  const spoken =
    numerator === '' && denominator === ''
      ? t('fractionPad.empty')
      : complete
        ? fractionInWords(
            { denominator: Number(denominator), numerator: Number(numerator), whole },
            translator.language,
          )
        : t('fractionPad.partial', { denominator: denominator || '…', numerator: numerator || '…' })

  const submit = () => {
    if (!complete) {
      if (numerator !== '' && slot === 'numerator') setSlot('denominator')
      return
    }
    onSubmit({
      denominator: Number(denominator),
      numerator: Number(numerator),
      type: 'fraction',
      whole,
    })
  }

  const box = (candidate: Slot) => (
    <button
      aria-label={t(
        candidate === 'numerator' ? 'fractionPad.numerator' : 'fractionPad.denominator',
        {
          value: (candidate === 'numerator' ? numerator : denominator) || t('fractionPad.blank'),
        },
      )}
      aria-pressed={slot === candidate}
      className={cn(
        'flex h-12 w-16 items-center justify-center rounded-control border-2 bg-surface text-title-1 font-black tabular',
        slot === candidate ? 'border-tint' : 'border-separator',
      )}
      disabled={disabled}
      onClick={() => setSlot(candidate)}
      type="button"
    >
      {(candidate === 'numerator' ? numerator : denominator) || ' '}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center justify-center gap-4"
        role="group"
        aria-label={t('practice.yourAnswer')}
      >
        {withWhole ? (
          <div aria-label={t('fractionPad.wholeLabel')} className="flex gap-1.5" role="radiogroup">
            {[0, 1, 2].map((option) => (
              <button
                aria-checked={whole === option}
                className={cn(
                  'min-h-11 rounded-full px-3 text-subhead font-extrabold',
                  whole === option ? 'bg-tint text-on-tint' : 'bg-surface-2 text-label',
                )}
                disabled={disabled}
                key={option}
                onClick={() => setWhole(option)}
                role="radio"
                type="button"
              >
                {option === 0 ? '0' : `${option} +`}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-1">
          {box('numerator')}
          <span aria-hidden className="h-1 w-18 rounded-full bg-label" />
          {box('denominator')}
        </div>
        <output aria-live="polite" className="sr-only">
          {spoken}
        </output>
      </div>
      <p className="text-center text-footnote font-semibold text-label-2">
        {slot === 'numerator' ? t('fractionPad.topFirst') : t('fractionPad.thenBottom')}
      </p>
      <DigitsPad
        canSubmit={complete || (numerator !== '' && slot === 'numerator')}
        disabled={disabled}
        onDigit={(key) => {
          if (key === 'erase') {
            if (value === '' && slot === 'denominator') setSlot('numerator')
            else setValue((current) => current.slice(0, -1))
            return
          }
          setValue((current) => (current.length >= 2 ? current : `${current}${key}`))
        }}
        onSubmit={submit}
        submitLabel={complete ? t('session.submit') : t('fractionPad.next')}
      />
    </div>
  )
}

const sameAnswer = (first: PracticeAnswer, second: PracticeAnswer) =>
  JSON.stringify(first) === JSON.stringify(second)

/** How an answer appears on a tile. */
export function AnswerFace({ answer }: Readonly<{ answer: PracticeAnswer }>) {
  const { language } = useI18n()
  if (answer.type === 'integer') return <>{formatNumber(answer.value, language)}</>
  if (answer.type === 'fraction') {
    if (answer.whole > 0 && answer.numerator === 0) return <>{answer.whole}</>
    return (
      <FractionText
        className="text-[2rem]"
        denominator={answer.denominator}
        label={fractionInWords(answer, language)}
        numerator={answer.numerator}
        whole={answer.whole}
      />
    )
  }
  if (answer.type === 'comparison') return <>{answer.symbol}</>
  return null
}

type ChoiceTilesProps = Readonly<{
  choices: ReadonlyArray<PracticeAnswer>
  /** Whether a choice is right, once the answer is settled. */
  isCorrect: (answer: PracticeAnswer) => boolean
  onChoose: (answer: PracticeAnswer) => void
  /** The answer given, once settled. */
  chosen: PracticeAnswer | null
}>

/** Answer tiles; once answered, the right one turns green and a miss turns warm. */
export function ChoiceTiles({ choices, chosen, isCorrect, onChoose }: ChoiceTilesProps) {
  const { language, t } = useI18n()
  const settled = chosen !== null
  return (
    <AnswerTiles
      disabled={settled}
      label={t('session.answers')}
      onPick={(answer) => onChoose(answer)}
      render={(answer) => <AnswerFace answer={answer} />}
      speak={(answer) => answerWords(answer, language)}
      stateOf={(answer): TileState =>
        !settled
          ? 'idle'
          : isCorrect(answer)
            ? 'correct'
            : sameAnswer(answer, chosen)
              ? 'wrong'
              : 'dimmed'
      }
      values={choices}
    />
  )
}

type ComparisonTilesProps = Readonly<{
  chosen: PracticeAnswer | null
  expected: PracticeAnswer
  onChoose: (answer: PracticeAnswer) => void
}>

const comparisons = [
  { key: 'compare.smaller', symbol: '<' },
  { key: 'compare.equal', symbol: '=' },
  { key: 'compare.larger', symbol: '>' },
] as const

/** The three comparison symbols, each with its meaning written under it (mockup C9). */
export function ComparisonTiles({ chosen, expected, onChoose }: ComparisonTilesProps) {
  const { t } = useI18n()
  const settled = chosen !== null
  return (
    <div aria-label={t('session.answers')} className="grid grid-cols-3 gap-2.5" role="group">
      {comparisons.map(({ key, symbol }) => {
        const answer: PracticeAnswer = { symbol, type: 'comparison' }
        const state = !settled
          ? 'idle'
          : sameAnswer(answer, expected)
            ? 'correct'
            : sameAnswer(answer, chosen)
              ? 'wrong'
              : 'dimmed'
        return (
          <button
            aria-label={t(key)}
            className={cn(
              'flex min-h-24 flex-col items-center justify-center gap-1 rounded-[1.5rem] border-2 shadow-[0_3px_0_var(--lt-separator)] transition-transform active:scale-[0.97]',
              state === 'correct' && 'border-leaf bg-leaf-soft text-leaf',
              state === 'wrong' && 'border-sun bg-sun-soft text-sun',
              state === 'dimmed' && 'border-separator bg-surface opacity-45',
              state === 'idle' && 'border-separator bg-surface text-label',
            )}
            disabled={settled}
            key={symbol}
            onClick={() => onChoose(answer)}
            type="button"
          >
            <span aria-hidden className="text-[2.5rem] leading-none font-black">
              {symbol}
            </span>
            <span aria-hidden className="text-caption font-bold text-label-2">
              {t(key)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

type MultiPickProps = Readonly<{
  correct: ReadonlyArray<number>
  onSubmit: (ids: ReadonlyArray<number>) => void
  options: ReadonlyArray<Fraction>
  settled: boolean
}>

/** Choose every equal fraction, then confirm. */
export function MultiPick({ correct, onSubmit, options, settled }: MultiPickProps) {
  const { language, t } = useI18n()
  const [picked, setPicked] = useState<ReadonlyArray<number>>([])
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((option, index) => {
          const on = picked.includes(index)
          const state = !settled
            ? on
              ? 'border-tint bg-tint-soft text-tint'
              : 'border-separator bg-surface text-label'
            : correct.includes(index)
              ? 'border-leaf bg-leaf-soft text-leaf'
              : on
                ? 'border-sun bg-sun-soft text-sun'
                : 'border-separator bg-surface opacity-45'
          return (
            <button
              aria-label={fractionInWords(option, language)}
              aria-pressed={on}
              className={cn(
                'relative flex min-h-24 items-center justify-center rounded-[1.5rem] border-2 shadow-[0_3px_0_var(--lt-separator)] active:scale-[0.97]',
                state,
              )}
              disabled={settled}
              key={`${option.numerator}/${option.denominator}`}
              onClick={() =>
                setPicked((current) =>
                  on ? current.filter((value) => value !== index) : [...current, index],
                )
              }
              type="button"
            >
              <FractionText
                className="text-[2rem]"
                denominator={option.denominator}
                numerator={option.numerator}
              />
              {on ? <Check aria-hidden className="absolute top-2 right-2 size-5" /> : null}
            </button>
          )
        })}
      </div>
      {settled ? null : (
        <Button
          disabled={picked.length === 0}
          onClick={() => onSubmit(picked)}
          size="lg"
          width="full"
        >
          {t('exercise.confirmPick')}
        </Button>
      )}
    </div>
  )
}

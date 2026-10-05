import {
  type Exercise,
  type Fraction,
  isExerciseAnswerCorrect,
  type PracticeAnswer,
} from '@little-tables/domain'
import { m } from 'motion/react'
import { useState } from 'react'

import { answerWords, formatNumber, fractionInWords } from '../exercise-format.js'
import { useI18n } from '../i18n.js'
import { FractionText } from './fraction-text.js'

type DigitPadProps = Readonly<{
  canSubmit: boolean
  disabled: boolean
  onDelete: () => void
  onDigit: (digit: string) => void
  onSubmit: () => void
  submitLabel?: string
}>

/** The large thumb-reachable digit grid shared by every typed answer. */
export function DigitPad({
  canSubmit,
  disabled,
  onDelete,
  onDigit,
  onSubmit,
  submitLabel,
}: DigitPadProps) {
  const { t } = useI18n()
  return (
    <div className="keypad-grid">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <button disabled={disabled} key={digit} onClick={() => onDigit(digit)} type="button">
          {digit}
        </button>
      ))}
      <button
        aria-label={t('practice.delete')}
        disabled={disabled}
        onClick={onDelete}
        type="button"
      >
        ⌫
      </button>
      <button disabled={disabled} onClick={() => onDigit('0')} type="button">
        0
      </button>
      <button
        aria-label={submitLabel ?? t('practice.submit')}
        className="keypad-submit"
        disabled={disabled || !canSubmit}
        onClick={onSubmit}
        type="button"
      >
        ✓
      </button>
    </div>
  )
}

type NumberEntryProps = Readonly<{
  disabled: boolean
  label: string
  maxDigits?: number
  onSubmit: (value: number) => void
}>

/** Typed whole-number answers up to 10 000, shown with the learner's thousands separator. */
export function NumberEntry({ disabled, label, maxDigits = 5, onSubmit }: NumberEntryProps) {
  const { locale, t } = useI18n()
  const [value, setValue] = useState('')
  return (
    <div className="keypad-wrap">
      <output aria-label={label} aria-live="polite" className="keypad-display">
        {value === '' ? '—' : formatNumber(Number(value), locale)}
      </output>
      <DigitPad
        canSubmit={value.length > 0}
        disabled={disabled}
        onDelete={() => setValue((current) => current.slice(0, -1))}
        onDigit={(digit) =>
          setValue((current) =>
            current.length >= maxDigits ? current : current === '0' ? digit : `${current}${digit}`,
          )
        }
        onSubmit={() => onSubmit(Number(value))}
      />
      <span className="recall-note">{t('practice.recallNote')}</span>
    </div>
  )
}

type FractionKeypadProps = Readonly<{
  disabled: boolean
  label: string
  onSubmit: (answer: PracticeAnswer) => void
  withWhole: boolean
}>

type Slot = 'denominator' | 'numerator'

/**
 * Two stacked boxes, numerator over denominator. Digits go to the highlighted box; ✓ first moves
 * down to the denominator, then answers. Either box can also be chosen by tapping it.
 */
export function FractionKeypad({ disabled, label, onSubmit, withWhole }: FractionKeypadProps) {
  const { locale, t } = useI18n()
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
            locale,
          )
        : t('fractionPad.partial', {
            denominator: denominator || '…',
            numerator: numerator || '…',
          })

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

  return (
    <div className="keypad-wrap fraction-keypad">
      <div className="fraction-entry" role="group" aria-label={label}>
        {withWhole ? (
          <div aria-label={t('fractionPad.wholeLabel')} className="whole-chips" role="radiogroup">
            {[0, 1, 2].map((option) => (
              <button
                aria-checked={whole === option}
                className="whole-chip"
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
        <div className="fraction-slots">
          {(['numerator', 'denominator'] as const).map((candidate) => (
            <button
              aria-label={t(
                candidate === 'numerator' ? 'fractionPad.numerator' : 'fractionPad.denominator',
                {
                  value:
                    (candidate === 'numerator' ? numerator : denominator) || t('fractionPad.blank'),
                },
              )}
              aria-pressed={slot === candidate}
              className={`fraction-slot fraction-slot-${candidate}${slot === candidate ? ' is-active' : ''}`}
              disabled={disabled}
              key={candidate}
              onClick={() => setSlot(candidate)}
              type="button"
            >
              {(candidate === 'numerator' ? numerator : denominator) || ' '}
            </button>
          ))}
          <span aria-hidden="true" className="fraction-slot-bar" />
        </div>
        <output aria-live="polite" className="sr-only">
          {spoken}
        </output>
      </div>
      <DigitPad
        canSubmit={complete || (numerator !== '' && slot === 'numerator')}
        disabled={disabled}
        onDelete={() => {
          if (value === '' && slot === 'denominator') {
            setSlot('numerator')
            return
          }
          setValue((current) => current.slice(0, -1))
        }}
        onDigit={(digit) =>
          setValue((current) => (current.length >= 2 ? current : `${current}${digit}`))
        }
        onSubmit={submit}
        submitLabel={complete ? t('practice.submit') : t('fractionPad.next')}
      />
      <span className="recall-note">
        {slot === 'numerator' ? t('fractionPad.topFirst') : t('fractionPad.thenBottom')}
      </span>
    </div>
  )
}

const answerKey = (answer: PracticeAnswer): string => JSON.stringify(answer)

function AnswerFace({ answer }: Readonly<{ answer: PracticeAnswer }>) {
  const { locale } = useI18n()
  if (answer.type === 'integer') return <>{formatNumber(answer.value, locale)}</>
  if (answer.type === 'fraction') {
    if (answer.whole > 0 && answer.numerator === 0) return <>{answer.whole}</>
    return (
      <FractionText
        denominator={answer.denominator}
        numerator={answer.numerator}
        whole={answer.whole}
      />
    )
  }
  if (answer.type === 'comparison') return <>{answer.symbol}</>
  return null
}

type AnswerTilesProps = Readonly<{
  choices: ReadonlyArray<PracticeAnswer>
  className?: string
  exercise: Exercise
  onChoose: (answer: PracticeAnswer) => void
  selected: PracticeAnswer | null
  settled: boolean
}>

/** Four large tiles; after answering, the right one turns green and a miss turns soft pink. */
export function AnswerTiles({
  choices,
  className = '',
  exercise,
  onChoose,
  selected,
  settled,
}: AnswerTilesProps) {
  const { locale } = useI18n()
  return (
    <div className={`answer-grid ${className}`}>
      {choices.map((choice) => {
        const correct = isExerciseAnswerCorrect(exercise, choice)
        const chosen = selected !== null && answerKey(selected) === answerKey(choice)
        const state = !settled
          ? ''
          : correct
            ? ' answer-correct'
            : chosen
              ? ' answer-try-again'
              : ' answer-muted'
        return (
          <m.button
            aria-label={answerWords(choice, locale)}
            className={`answer-tile${choice.type === 'fraction' ? ' answer-tile-fraction' : ''}${state}`}
            disabled={settled}
            key={answerKey(choice)}
            onClick={() => onChoose(choice)}
            type="button"
            whileTap={{ scale: 0.96 }}
          >
            <AnswerFace answer={choice} />
          </m.button>
        )
      })}
    </div>
  )
}

type MultiPickProps = Readonly<{
  correctIndexes: ReadonlyArray<number>
  onSubmit: (ids: ReadonlyArray<number>) => void
  options: ReadonlyArray<Fraction>
  settled: boolean
}>

/** Choose every equal fraction, then confirm. Each tile is a toggle button. */
export function MultiPick({ correctIndexes, onSubmit, options, settled }: MultiPickProps) {
  const { locale, t } = useI18n()
  const [picked, setPicked] = useState<ReadonlyArray<number>>([])
  const pickedSet = new Set(picked)
  const correctSet = new Set(correctIndexes)
  return (
    <div className="multi-pick">
      <div className="answer-grid multi-pick-grid">
        {options.map((option, index) => {
          const on = pickedSet.has(index)
          const state = !settled
            ? on
              ? ' is-picked'
              : ''
            : correctSet.has(index)
              ? ' answer-correct'
              : on
                ? ' answer-try-again'
                : ' answer-muted'
          return (
            <m.button
              aria-label={fractionInWords(option, locale)}
              aria-pressed={on}
              className={`answer-tile answer-tile-fraction${state}`}
              disabled={settled}
              key={`${option.numerator}/${option.denominator}`}
              onClick={() =>
                setPicked((current) =>
                  on ? current.filter((value) => value !== index) : [...current, index],
                )
              }
              type="button"
              whileTap={{ scale: 0.96 }}
            >
              <FractionText denominator={option.denominator} numerator={option.numerator} />
              <span aria-hidden="true" className="pick-check">
                ✓
              </span>
            </m.button>
          )
        })}
      </div>
      <button
        className="primary-button exercise-confirm"
        disabled={settled || picked.length === 0}
        onClick={() => onSubmit(picked)}
        type="button"
      >
        {t('exercise.confirmPick')}
      </button>
    </div>
  )
}

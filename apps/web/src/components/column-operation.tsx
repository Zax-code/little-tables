import { columnResult, type ColumnExercise, type SubtractionMethod } from '@little-tables/domain'
import { m, useReducedMotion } from 'motion/react'
import { useState } from 'react'

import { digitAt, firstWrongColumn } from '../column-math.js'
import { formatNumber } from '../exercise-format.js'
import { useI18n } from '../i18n.js'
import { DigitPad } from './answer-pads.js'

const placeKeys = [
  'place.units',
  'place.tens',
  'place.hundreds',
  'place.thousands',
  'place.tenThousands',
] as const
const placeShortKeys = [
  'place.short.units',
  'place.short.tens',
  'place.short.hundreds',
  'place.short.thousands',
  'place.short.tenThousands',
] as const

type ColumnOperationProps = Readonly<{
  exercise: ColumnExercise
  method: SubtractionMethod
  onSubmit: (value: number) => void
  outcome: Readonly<{ correct: boolean }> | null
}>

/**
 * A written calculation in columns. The result is written from the units leftwards, one box at a
 * time. Carries and exchanges are optional helpers the learner can tap; they are never marked.
 */
export function ColumnOperation({ exercise, method, onSubmit, outcome }: ColumnOperationProps) {
  const { locale, t } = useI18n()
  const reduceMotion = useReducedMotion() === true
  const result = columnResult(exercise)
  const width = Math.max(
    String(result).length,
    ...exercise.terms.map((term) => String(term).length),
  )
  const [cells, setCells] = useState<ReadonlyArray<string>>(() =>
    Array.from({ length: width }, () => ''),
  )
  const [active, setActive] = useState(0)
  const [exchanges, setExchanges] = useState<ReadonlyArray<number>>(() =>
    Array.from({ length: width }, () => 0),
  )
  const settled = outcome !== null
  const subtract = exercise.operation === 'subtract'
  const columns = Array.from({ length: width }, (_, index) => width - 1 - index)
  const highestFilled = cells.reduce(
    (highest, cell, column) => (cell === '' ? highest : column),
    -1,
  )
  const contiguous = cells.slice(0, highestFilled + 1).every((cell) => cell !== '')
  const canSubmit = cells[0] !== '' && contiguous
  const written = canSubmit
    ? Number([...cells.slice(0, highestFilled + 1)].reverse().join(''))
    : null
  const wrongColumn = outcome !== null && !outcome.correct ? firstWrongColumn(cells, result) : null
  const sign = subtract ? '−' : '+'
  const top = exercise.terms[0] ?? 0

  const write = (digit: string) => {
    setCells((current) => current.map((cell, column) => (column === active ? digit : cell)))
    setActive((current) => Math.min(width - 1, current + 1))
  }
  const erase = () => {
    if ((cells[active] ?? '') !== '') {
      setCells((current) => current.map((cell, column) => (column === active ? '' : cell)))
      return
    }
    const previous = Math.max(0, active - 1)
    setActive(previous)
    setCells((current) => current.map((cell, column) => (column === previous ? '' : cell)))
  }
  const toggleExchange = (column: number) => {
    const limit = !subtract && exercise.terms.length === 3 ? 2 : 1
    setExchanges((current) =>
      current.map((value, index) => (index === column ? (value + 1) % (limit + 1) : value)),
    )
  }
  const canExchange = (column: number) =>
    subtract ? column <= width - 2 && digitAt(top, column + 1) !== '' : column >= 1

  /** The top digit after the exchanges the learner noted, for the “break a ten” method. */
  const brokenTopDigit = (column: number): string | null => {
    if (
      !subtract ||
      method !== 'decomposition' ||
      column === 0 ||
      (exchanges[column - 1] ?? 0) === 0
    ) {
      return null
    }
    const value = Number(digitAt(top, column) || 0) + 10 * (exchanges[column] ?? 0) - 1
    return value >= 0 ? String(value) : ''
  }

  return (
    <div className="column-operation">
      <div
        className="column-grid"
        style={{ gridTemplateColumns: `minmax(28px, 0.7fr) repeat(${width}, minmax(44px, 1fr))` }}
      >
        <span aria-hidden="true" />
        {columns.map((column) => (
          <span aria-hidden="true" className="column-place" key={`place-${column}`}>
            {t(placeShortKeys[column] ?? 'place.short.units')}
          </span>
        ))}

        <span aria-hidden="true" />
        {columns.map((column) =>
          canExchange(column) ? (
            <button
              aria-label={t(subtract ? 'column.exchangeLabel' : 'column.carryLabel', {
                place: t(placeKeys[column] ?? 'place.units'),
              })}
              aria-pressed={(exchanges[column] ?? 0) > 0}
              className={`column-carry${(exchanges[column] ?? 0) > 0 ? ' is-on' : ''}`}
              disabled={settled}
              key={`carry-${column}`}
              onClick={() => toggleExchange(column)}
              type="button"
            >
              {(exchanges[column] ?? 0) > 0 ? (subtract ? '1' : exchanges[column]) : ''}
            </button>
          ) : (
            <span className="column-carry-spacer" key={`carry-${column}`} />
          ),
        )}

        {exercise.terms.map((term, row) => (
          <div
            aria-hidden="true"
            className="column-row"
            key={`row-${row}`}
            style={{ display: 'contents' }}
          >
            <span className="column-sign">{row === 0 ? '' : sign}</span>
            {columns.map((column) => {
              const digit = digitAt(term, column)
              const tenAdded = subtract && row === 0 && (exchanges[column] ?? 0) > 0
              const plusOne =
                subtract &&
                method === 'compensation' &&
                row === 1 &&
                column > 0 &&
                (exchanges[column - 1] ?? 0) > 0
              const broken = row === 0 ? brokenTopDigit(column) : null
              return (
                <span className="column-digit" key={`digit-${row}-${column}`}>
                  {broken === null ? null : <span className="digit-broken-value">{broken}</span>}
                  {tenAdded ? <span className="digit-ten">1</span> : null}
                  <span className={broken === null ? '' : 'digit-struck'}>{digit}</span>
                  {plusOne ? <span className="digit-plus-one">+1</span> : null}
                </span>
              )
            })}
          </div>
        ))}

        <span
          aria-hidden="true"
          className="column-bar"
          style={{ gridColumn: `1 / span ${width + 1}` }}
        />

        <span aria-hidden="true" />
        {columns.map((column) => {
          const state =
            outcome === null
              ? column === active
                ? ' is-active'
                : ''
              : outcome.correct
                ? ' is-correct'
                : column === wrongColumn
                  ? ' is-wrong'
                  : ''
          return (
            <button
              aria-label={t('column.resultCell', {
                place: t(placeKeys[column] ?? 'place.units'),
                value: cells[column] === '' ? t('column.empty') : (cells[column] ?? ''),
              })}
              aria-pressed={column === active && !settled}
              className={`column-cell${state}`}
              disabled={settled}
              key={`cell-${column}`}
              onClick={() => setActive(column)}
              type="button"
            >
              {cells[column] === '' ? null : (
                <m.span
                  animate={{ scale: 1 }}
                  initial={reduceMotion ? false : { scale: 0.6 }}
                  key={cells[column]}
                >
                  {cells[column]}
                </m.span>
              )}
            </button>
          )
        })}
      </div>
      <output aria-live="polite" className="sr-only">
        {written === null
          ? t('column.writing', { place: t(placeKeys[active] ?? 'place.units') })
          : t('column.current', { value: formatNumber(written, locale) })}
      </output>
      {wrongColumn === null ? null : (
        <p className="column-wrong-note" role="status">
          {t('column.lookHere', { place: t(placeKeys[wrongColumn] ?? 'place.units') })}
        </p>
      )}
      <DigitPad
        canSubmit={canSubmit}
        disabled={settled}
        onDelete={erase}
        onDigit={write}
        onSubmit={() => {
          if (written !== null) onSubmit(written)
        }}
      />
    </div>
  )
}

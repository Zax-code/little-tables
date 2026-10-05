/**
 * Written calculations in columns (mockup C6). The result is written from the units leftwards,
 * one box at a time; carries and exchanges are optional helpers, never marked.
 */
import type { Exercise, LearningPathSettings } from '@little-tables/engine/schema'
import { cn } from '@little-tables/ui'
import { m, useReducedMotion } from 'motion/react'

import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { digitAt, firstWrongColumn, placeKeys, type ColumnEntry } from './column-entry.js'
import { formatNumber } from './format.js'

type SubtractionMethod = LearningPathSettings['subtractionMethod']
type ColumnExercise = Extract<Exercise, { kind: 'column' }>

const placeShortKeys = [
  'place.short.units',
  'place.short.tens',
  'place.short.hundreds',
  'place.short.thousands',
  'place.short.tenThousands',
] as const satisfies ReadonlyArray<MessageKey>

type ColumnGridProps = Readonly<{
  entry: ColumnEntry
  exercise: ColumnExercise
  method: SubtractionMethod
  outcome: Readonly<{ correct: boolean }> | null
  result: number
}>

export function ColumnGrid({ entry, exercise, method, outcome, result }: ColumnGridProps) {
  const translator = useI18n()
  const { t } = translator
  const reduced = useReducedMotion() === true
  const { active, cells, exchanges, width } = entry
  const settled = outcome !== null
  const subtract = exercise.operation === 'subtract'
  const columns = Array.from({ length: width }, (_, index) => width - 1 - index)
  const wrongColumn = outcome !== null && !outcome.correct ? firstWrongColumn(cells, result) : null
  const top = exercise.terms[0] ?? 0
  const place = (column: number) => t(placeKeys[column] ?? 'place.units')
  const canExchange = (column: number) =>
    subtract ? column <= width - 2 && digitAt(top, column + 1) !== '' : column >= 1
  /** The top digit after the exchanges noted, for the “break a ten” method. */
  const brokenTopDigit = (column: number) => {
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
  const grid = { gridTemplateColumns: `2rem repeat(${width}, minmax(2.75rem, 3.5rem))` }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid items-center gap-x-2 gap-y-1.5 rounded-card bg-surface px-4 py-3"
        style={grid}
      >
        <span aria-hidden />
        {columns.map((column) => (
          <span
            aria-hidden
            className="text-center text-footnote font-bold text-label-3"
            key={`place-${column}`}
          >
            {t(placeShortKeys[column] ?? 'place.short.units')}
          </span>
        ))}

        <span aria-hidden />
        {columns.map((column) =>
          canExchange(column) ? (
            <button
              aria-label={t(subtract ? 'column.exchangeLabel' : 'column.carryLabel', {
                place: place(column),
              })}
              aria-pressed={(exchanges[column] ?? 0) > 0}
              className={cn(
                'mx-auto h-7 w-full rounded-full text-subhead font-black transition-colors',
                (exchanges[column] ?? 0) > 0 ? 'bg-tint-soft text-tint' : 'bg-surface-2',
              )}
              disabled={settled}
              key={`carry-${column}`}
              onClick={() => entry.toggleExchange(column)}
              type="button"
            >
              {(exchanges[column] ?? 0) > 0 ? (subtract ? '1' : exchanges[column]) : ''}
            </button>
          ) : (
            <span className="h-7" key={`carry-${column}`} />
          ),
        )}

        {exercise.terms.map((term, row) => (
          <div aria-hidden className="contents" key={`row-${row}`}>
            <span className="text-center text-title-2 font-black text-label-2">
              {row === 0 ? '' : subtract ? '−' : '+'}
            </span>
            {columns.map((column) => {
              const tenAdded = subtract && row === 0 && (exchanges[column] ?? 0) > 0
              const plusOne =
                subtract &&
                method === 'compensation' &&
                row === 1 &&
                column > 0 &&
                (exchanges[column - 1] ?? 0) > 0
              const broken = row === 0 ? brokenTopDigit(column) : null
              return (
                <span
                  className="relative text-center text-[2rem] leading-tight font-black tabular"
                  key={`digit-${row}-${column}`}
                >
                  {broken === null ? null : (
                    <span className="absolute -top-3 right-0 text-footnote font-black text-tint">
                      {broken}
                    </span>
                  )}
                  {tenAdded ? <span className="text-subhead font-black text-tint">1</span> : null}
                  <span className={broken === null ? '' : 'text-label-3 line-through'}>
                    {digitAt(term, column)}
                  </span>
                  {plusOne ? (
                    <span className="absolute -bottom-2 right-0 text-footnote font-black text-tint">
                      +1
                    </span>
                  ) : null}
                </span>
              )
            })}
          </div>
        ))}

        <span
          aria-hidden
          className="h-0.75 rounded-full bg-label"
          style={{ gridColumn: `1 / span ${width + 1}` }}
        />

        <span aria-hidden />
        {columns.map((column) => (
          <button
            aria-label={t('column.resultCell', {
              place: place(column),
              value: cells[column] === '' ? t('column.empty') : (cells[column] ?? ''),
            })}
            aria-pressed={column === active && !settled}
            className={cn(
              'flex h-14 items-center justify-center rounded-control border-2 text-[2rem] font-black tabular transition-colors',
              outcome === null
                ? column === active
                  ? 'border-tint bg-surface'
                  : 'border-transparent bg-surface-2'
                : outcome.correct
                  ? 'border-leaf bg-leaf-soft text-leaf'
                  : column === wrongColumn
                    ? 'border-sun bg-sun-soft text-sun'
                    : 'border-transparent bg-surface-2',
            )}
            disabled={settled}
            key={`cell-${column}`}
            onClick={() => entry.setActive(column)}
            type="button"
          >
            {cells[column] === '' ? null : (
              <m.span
                animate={{ scale: 1 }}
                initial={reduced ? false : { scale: 0.6 }}
                key={cells[column]}
              >
                {cells[column]}
              </m.span>
            )}
          </button>
        ))}
      </div>
      <output aria-live="polite" className="sr-only">
        {entry.written === null
          ? t('column.writing', { place: place(active) })
          : t('column.current', { value: formatNumber(entry.written, translator.language) })}
      </output>
      {wrongColumn === null ? null : (
        <p className="text-subhead font-bold text-sun" role="status">
          {t('column.lookHere', { place: place(wrongColumn) })}
        </p>
      )}
    </div>
  )
}

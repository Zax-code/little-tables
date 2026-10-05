/** The digits of a column calculation: place names, the steps on paper and what is written. */
import type { Exercise } from '@little-tables/engine/schema'
import { useState } from 'react'

import type { MessageKey } from '../i18n/translator.js'

type ColumnExercise = Extract<Exercise, { kind: 'column' }>

export const placeKeys = [
  'place.units',
  'place.tens',
  'place.hundreds',
  'place.thousands',
  'place.tenThousands',
] as const satisfies ReadonlyArray<MessageKey>

/** The digit of a number in a column counted from the units, or '' past its last digit. */
export const digitAt = (value: number, column: number) => {
  const text = String(value)
  return text[text.length - 1 - column] ?? ''
}

/** The first column, from the units, whose written digit differs from the right result. */
export const firstWrongColumn = (cells: ReadonlyArray<string>, expected: number): number | null => {
  const width = Math.max(cells.length, String(expected).length)
  for (let column = 0; column < width; column += 1) {
    const written = cells[column] ?? ''
    const right = digitAt(expected, column)
    if (!(written === right || (right === '' && (written === '' || written === '0')))) return column
  }
  return null
}

export type ColumnStep = Readonly<{
  bottom: number
  column: number
  exchange: boolean
  incoming: number
  top: number
}>

/** Walks the calculation column by column, as on paper. */
export const columnSteps = (exercise: ColumnExercise): ReadonlyArray<ColumnStep> => {
  const digit = (value: number, column: number) => Number(digitAt(value, column) || 0)
  const width = Math.max(...exercise.terms.map((term) => String(term).length))
  const steps: ColumnStep[] = []
  let incoming = 0
  for (let column = 0; column < width; column += 1) {
    if (exercise.operation === 'add') {
      const total = exercise.terms.reduce((sum, term) => sum + digit(term, column), 0) + incoming
      steps.push({ bottom: 0, column, exchange: total >= 10, incoming, top: total })
      incoming = Math.floor(total / 10)
    } else {
      const top = digit(exercise.terms[0] ?? 0, column)
      const bottom = digit(exercise.terms[1] ?? 0, column)
      const exchange = top < bottom + incoming
      steps.push({ bottom, column, exchange, incoming, top })
      incoming = exchange ? 1 : 0
    }
  }
  return steps
}

/** What the child has written in the result boxes and the helpers they noted. */
export function useColumnEntry(exercise: ColumnExercise, result: number) {
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
  const highestFilled = cells.reduce(
    (highest, cell, column) => (cell === '' ? highest : column),
    -1,
  )
  const contiguous = cells.slice(0, highestFilled + 1).every((cell) => cell !== '')
  const canSubmit = cells[0] !== '' && contiguous
  return {
    active,
    canSubmit,
    cells,
    erase: () => {
      if ((cells[active] ?? '') !== '') {
        setCells((current) => current.map((cell, column) => (column === active ? '' : cell)))
        return
      }
      const previous = Math.max(0, active - 1)
      setActive(previous)
      setCells((current) => current.map((cell, column) => (column === previous ? '' : cell)))
    },
    exchanges,
    setActive,
    toggleExchange: (column: number) => {
      const limit = exercise.operation === 'add' && exercise.terms.length === 3 ? 2 : 1
      setExchanges((current) =>
        current.map((value, index) => (index === column ? (value + 1) % (limit + 1) : value)),
      )
    },
    width,
    write: (digit: string) => {
      setCells((current) => current.map((cell, column) => (column === active ? digit : cell)))
      setActive((current) => Math.min(width - 1, current + 1))
    },
    written: canSubmit ? Number([...cells.slice(0, highestFilled + 1)].reverse().join('')) : null,
  }
}

export type ColumnEntry = ReturnType<typeof useColumnEntry>

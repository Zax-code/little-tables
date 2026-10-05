import type { ColumnExercise } from '@little-tables/domain'

const digitText = (value: number, column: number): string => {
  const text = String(value)
  return text[text.length - 1 - column] ?? ''
}

/** The digit of a number in a column, counted from the units, or '' past its last digit. */
export const digitAt = digitText

/** The first column, from the units, whose written digit differs from the right result. */
export const firstWrongColumn = (cells: ReadonlyArray<string>, expected: number): number | null => {
  const width = Math.max(cells.length, String(expected).length)
  for (let column = 0; column < width; column += 1) {
    const written = cells[column] ?? ''
    const right = digitText(expected, column)
    const same = written === right || (right === '' && (written === '' || written === '0'))
    if (!same) return column
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

/** Walks a written calculation column by column, the way it is done on paper. */
export const columnSteps = (exercise: ColumnExercise): ReadonlyArray<ColumnStep> => {
  const digit = (value: number, column: number) => Number(digitText(value, column) || 0)
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

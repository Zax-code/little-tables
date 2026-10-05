import {
  Ce2Engine,
  type Ce2ColumnStep,
  type Ce2Draft,
  type Ce2Question,
} from '@little-tables/domain'

const columns = ['thousands', 'hundreds', 'tens', 'units'] as const

export function ce2ColumnSteps(
  question: Ce2Question,
  draft: Ce2Draft,
): ReadonlyArray<Ce2ColumnStep> {
  if (question.family !== 'column' || draft.freeMode) return []
  const expected = Ce2Engine.expectedColumnSteps(question)
  const allResultsEntered = expected.every(
    (step) => draft.columnEntries[`result-${step.column}`] === step.resultDigit,
  )
  const expectedCarries: Record<string, number> = {}
  const expectedBorrows: Record<string, number> = {}
  for (const step of expected) {
    if (step.operation === 'add' && step.outgoing > 0) {
      const stepIndex = columns.indexOf(step.column)
      const receivingColumn = columns[stepIndex - 1]
      if (receivingColumn !== undefined) expectedCarries[receivingColumn] = step.outgoing
    }
    if (step.operation === 'subtract' && step.incoming > 0) {
      expectedBorrows[step.column] = 1
    }
  }
  const exactNotes =
    entriesMatch(draft.carries, expectedCarries) && entriesMatch(draft.borrows, expectedBorrows)
  return allResultsEntered && exactNotes ? expected : []
}

function entriesMatch(
  actual: Readonly<Record<string, number>>,
  expected: Readonly<Record<string, number>>,
): boolean {
  return (
    Object.entries(expected).every(([column, value]) => actual[column] === value) &&
    Object.entries(actual).every(([column, value]) => value === (expected[column] ?? 0))
  )
}

// @vitest-environment happy-dom

import type { Ce2Draft, Ce2Question } from '@little-tables/domain'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ce2ColumnSteps } from './ce2-column-steps.js'
import { Ce2QuestionCard, type Ce2QuestionFeedback } from './ce2-question-card.js'

const common = {
  choices: [],
  contentVersion: 'ce2-2026-v1',
  generationSeed: 42,
  inputConstraints: {
    denominatorMax: 12,
    explicitValidation: true,
    maxDigits: 4,
    maximumSelections: null,
    minimumSelections: null,
    numeratorMax: 12,
  },
  module: 'fractions',
  noveltyKey: 'novel-1',
  requiredDenominator: null,
  schemaVersion: 'ce2-question/v1',
  tier: 1,
} as const

const freshDraft = (questionId: string): Ce2Draft => ({
  activeColumn: null,
  activeElapsedMs: 0,
  answer: null,
  borrows: {},
  carries: {},
  columnEntries: {},
  freeMode: false,
  helpOpened: false,
  orderedIds: [],
  questionId,
  resultRevealed: false,
  schemaVersion: 'ce2-draft/v1',
  selectedPartIds: [],
  switchedToFree: false,
  updatedAt: new Date('2026-10-04T12:00:00.000Z'),
})

describe('Ce2QuestionCard', () => {
  let container: HTMLDivElement
  let root: Root
  const onHelp = vi.fn()
  const onSubmit = vi.fn()

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.clearAllMocks()
  })

  function renderCard(question: Ce2Question, feedback?: Ce2QuestionFeedback) {
    function Harness() {
      const [draft, setDraft] = useState(() => freshDraft(question.id))
      return (
        <Ce2QuestionCard
          draft={draft}
          {...(feedback === undefined ? {} : { feedback })}
          locale="fr"
          onDraftChange={setDraft}
          onHelp={onHelp}
          onSubmit={onSubmit}
          question={question}
        />
      )
    }
    act(() => root.render(<Harness />))
  }

  function enter(input: HTMLInputElement | undefined, value: string) {
    if (input === undefined) throw new Error('Missing input')
    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
      if (descriptor?.set === undefined) throw new Error('Missing input value setter')
      descriptor.set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('builds a fraction from equal tap targets and waits for explicit validation', () => {
    const question = {
      ...common,
      family: 'fraction',
      id: 'f2-represent',
      operands: [{ denominator: 5, numerator: 3 }],
      partitions: [],
      prompt: 'Colorie trois cinquièmes de la bande.',
      representation: 'bar',
      responseMode: 'fraction',
      skill: 'F2',
      solution: { denominator: 5, numerator: 3, type: 'fraction' },
      task: 'represent',
    } as const satisfies Ce2Question
    renderCard(question)

    const parts = container.querySelectorAll<HTMLButtonElement>('.ce2-part')
    expect(parts).toHaveLength(5)
    expect(parts[0]?.getAttribute('aria-label')).toContain('non sélectionnée')

    act(() => parts[0]?.click())
    act(() => parts[1]?.click())
    act(() => parts[2]?.click())

    expect(container.querySelector('[aria-label="3 parties sélectionnées sur 5"]')).not.toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
    const submit = container.querySelector<HTMLButtonElement>('.ce2-card__submit')
    expect(submit?.disabled).toBe(false)
    act(() => submit?.click())
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('renders the supplied F1 partition geometry instead of inferring equality from color', () => {
    const question = {
      ...common,
      choices: [
        {
          answer: { choiceIds: ['equal'], type: 'selection' },
          id: 'equal',
          label: 'equal',
        },
        {
          answer: { choiceIds: ['unequal'], type: 'selection' },
          id: 'unequal',
          label: 'unequal',
        },
      ],
      family: 'fraction',
      id: 'f1-parts',
      operands: [{ denominator: 4, numerator: 1 }],
      partitions: [
        { id: 'equal', segmentWeights: [1, 1, 1, 1] },
        { id: 'unequal', segmentWeights: [1, 2, 1, 2] },
      ],
      prompt: 'ce2.F1.equal-parts',
      representation: 'bar',
      responseMode: 'choice',
      skill: 'F1',
      solution: { choiceIds: ['equal'], type: 'selection' },
      task: 'equal-parts',
    } as const satisfies Ce2Question
    renderCard(question)

    const partitions = container.querySelectorAll<HTMLElement>('.ce2-partition-choice')
    expect(partitions[0]?.style.gridTemplateColumns).toBe('1fr 1fr 1fr 1fr')
    expect(partitions[1]?.style.gridTemplateColumns).toBe('1fr 2fr 1fr 2fr')
    expect(container.querySelector('.ce2-card__expression')).toBeNull()
    expect(container.querySelector('.ce2-choice')?.getAttribute('aria-label')).toBe(
      'Forme A, largeurs des parts 1, 1, 1, 1',
    )
  })

  it('shows the F2 quantity as a model without printing its fraction outside the choices', () => {
    const question = {
      ...common,
      choices: [
        { answer: { denominator: 4, numerator: 1, type: 'fraction' }, id: 'one', label: '1/4' },
        { answer: { denominator: 4, numerator: 3, type: 'fraction' }, id: 'three', label: '3/4' },
      ],
      family: 'fraction',
      id: 'f2-read',
      operands: [{ denominator: 4, numerator: 3 }],
      partitions: [],
      prompt: 'ce2.F2.read-represent',
      representation: 'bar',
      responseMode: 'choice',
      skill: 'F2',
      solution: { denominator: 4, numerator: 3, type: 'fraction' },
      task: 'represent',
    } as const satisfies Ce2Question
    renderCard(question)

    expect(container.querySelector('.ce2-band')).not.toBeNull()
    expect(container.querySelector('.ce2-card__expression')).toBeNull()
    expect(container.querySelectorAll('.ce2-fraction')).toHaveLength(2)
  })

  it('moves a number-line marker only between exact ticks using 44px button controls', () => {
    const question = {
      ...common,
      denominator: 4,
      family: 'number-line',
      id: 'f5-line',
      prompt: 'Place trois quarts sur la graduation.',
      representation: 'graduated-line',
      responseMode: 'number-line',
      skill: 'F5',
      solution: { tick: 3, type: 'number-line' },
      target: { denominator: 4, numerator: 3 },
      tickCount: 4,
    } as const satisfies Ce2Question
    renderCard(question)

    const next = container.querySelector<HTMLButtonElement>(
      '[aria-label="Aller à la graduation suivante"]',
    )
    expect(next).not.toBeNull()
    act(() => next?.click())
    act(() => next?.click())
    act(() => next?.click())

    expect(container.textContent).toContain('Repère sur la graduation 3 sur 4')
    expect(container.querySelector('[aria-pressed="true"][aria-label="3/4"]')).not.toBeNull()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps equivalent-format feedback editable and exposes the requested denominator hint', () => {
    const question = {
      ...common,
      family: 'fraction',
      id: 'f8-format',
      operands: [
        { denominator: 3, numerator: 1 },
        { denominator: 6, numerator: 1 },
      ],
      partitions: [],
      prompt: 'Calcule et écris le résultat en sixièmes.',
      representation: 'bar',
      requiredDenominator: 6,
      responseMode: 'fraction',
      skill: 'F8',
      solution: { denominator: 6, numerator: 3, type: 'fraction' },
      task: 'add',
    } as const satisfies Ce2Question
    renderCard(question, { kind: 'format' })

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'C’est la même quantité',
    )
    const inputs = container.querySelectorAll<HTMLInputElement>('input')
    expect(inputs).toHaveLength(2)
    expect(inputs[1]?.disabled).toBe(false)
    act(() => container.querySelector<HTMLButtonElement>('.ce2-card__help')?.click())
    expect(container.querySelectorAll('.ce2-common-partition .ce2-band')).toHaveLength(2)
    expect(
      container
        .querySelector<HTMLElement>('.ce2-common-partition .ce2-band')
        ?.style.getPropertyValue('--ce2-parts'),
    ).toBe('6')
  })

  it('keeps a zero fraction denominator visible and prevents validation', () => {
    const question = {
      ...common,
      family: 'fraction',
      id: 'f8-zero-denominator',
      operands: [
        { denominator: 3, numerator: 1 },
        { denominator: 6, numerator: 1 },
      ],
      partitions: [],
      prompt: 'Calcule.',
      representation: 'bar',
      responseMode: 'fraction',
      skill: 'F8',
      solution: { denominator: 6, numerator: 3, type: 'fraction' },
      task: 'add',
    } as const satisfies Ce2Question
    renderCard(question)

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'))
    enter(inputs[0], '3')
    enter(inputs[1], '0')

    expect(inputs[1]?.value).toBe('0')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(true)
    enter(inputs[1], '6')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(false)
    enter(inputs[1], '')
    expect(inputs[1]?.value).toBe('')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(true)
  })

  it('supports autonomous digit placement separately from the calculated result', () => {
    const question = {
      ...common,
      family: 'column',
      id: 'a5-column',
      left: 678,
      mode: 'autonomous',
      module: 'arithmetic',
      operation: 'add',
      prompt: 'Pose puis calcule 678 + 459.',
      representation: 'column-grid',
      requiresCarry: true,
      requiresExchange: false,
      responseMode: 'column',
      right: 459,
      skill: 'A5',
      solution: {
        alignment: [],
        type: 'column',
        value: 1137,
      },
      zeroBridge: false,
    } as const satisfies Ce2Question
    renderCard(question)

    const leftUnits = container.querySelector<HTMLButtonElement>(
      '[aria-label="nombre du haut, colonne des unités"]',
    )
    expect(leftUnits).not.toBeNull()
    act(() => leftUnits?.click())
    const digitEight = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.ce2-column__keypad button'),
    ).find((button) => button.textContent === '8')
    act(() => digitEight?.click())
    expect(leftUnits?.textContent).toBe('8')

    const resultUnits = container.querySelector<HTMLButtonElement>(
      '[aria-label="Résultat, colonne des unités"]',
    )
    act(() => resultUnits?.click())
    act(() =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('.ce2-column__keypad button'))
        .find((button) => button.textContent === '7')
        ?.click(),
    )
    expect(resultUnits?.textContent).toBe('7')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(true)

    const placeDigit = (label: string, digit: string) => {
      const cell = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
      act(() => cell?.click())
      act(() =>
        Array.from(container.querySelectorAll<HTMLButtonElement>('.ce2-column__keypad button'))
          .find((button) => button.textContent === digit)
          ?.click(),
      )
    }
    placeDigit('nombre du haut, colonne des centaines', '6')
    placeDigit('nombre du haut, colonne des dizaines', '7')
    placeDigit('nombre du bas, colonne des centaines', '4')
    placeDigit('nombre du bas, colonne des dizaines', '5')
    placeDigit('nombre du bas, colonne des unités', '9')
    placeDigit('Résultat, colonne des milliers', '1')
    placeDigit('Résultat, colonne des centaines', '1')
    placeDigit('Résultat, colonne des dizaines', '3')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(false)
  })

  it('drops abandoned grid alignment when switching to the free-result method', () => {
    const question = {
      ...common,
      family: 'column',
      id: 'a5-free-column',
      left: 246,
      mode: 'autonomous',
      module: 'arithmetic',
      operation: 'add',
      prompt: 'Pose puis calcule 246 + 127.',
      representation: 'column-grid',
      requiresCarry: true,
      requiresExchange: false,
      responseMode: 'column',
      right: 127,
      skill: 'A5',
      solution: { alignment: [], type: 'column', value: 373 },
      zeroBridge: false,
    } as const satisfies Ce2Question
    let latestDraft: Ce2Draft = {
      ...freshDraft(question.id),
      answer: {
        alignment: [{ column: 'units', digit: 9, operand: 'left' }],
        type: 'column',
        value: 373,
      },
      columnEntries: { 'left-units': 9 },
    }
    function Harness() {
      const [draft, setDraft] = useState(latestDraft)
      latestDraft = draft
      return (
        <Ce2QuestionCard
          draft={draft}
          locale="fr"
          onDraftChange={setDraft}
          onHelp={onHelp}
          onSubmit={onSubmit}
          question={question}
        />
      )
    }
    act(() => root.render(<Harness />))
    act(() => container.querySelector<HTMLButtonElement>('.ce2-method-toggle')?.click())

    expect(latestDraft.answer).toEqual({ alignment: [], type: 'column', value: 373 })
    expect(latestDraft.switchedToFree).toBe(true)
  })

  it('opens localized assistance without submitting or revealing the result', () => {
    const question = {
      ...common,
      family: 'place-value',
      id: 'n1-place',
      module: 'arithmetic',
      prompt: 'Décompose 462.',
      representation: 'blocks',
      responseMode: 'place-value',
      skill: 'N1',
      solution: { hundreds: 4, tens: 6, type: 'place-value', units: 2 },
      value: 462,
    } as const satisfies Ce2Question
    renderCard(question)

    const help = container.querySelector<HTMLButtonElement>('.ce2-card__help')
    act(() => help?.click())

    expect(onHelp).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Une centaine, c’est dix dizaines')

    act(() => help?.click())
    expect(container.textContent).not.toContain('Une centaine, c’est dix dizaines')
    act(() => help?.click())
    expect(onHelp).toHaveBeenCalledOnce()
  })

  it.each([
    [402, 185, '4C · 0D · 2U', '3C · 10D · 2U', '3C · 9D · 12U'],
    [600, 247, '6C · 0D · 0U', '5C · 10D · 0U', '5C · 9D · 10U'],
  ])('preserves every digit while showing the zero exchange for %i', (left, right, ...stages) => {
    const question = {
      ...common,
      family: 'column',
      id: `s5-zero-${left}`,
      left,
      mode: 'guided',
      module: 'arithmetic',
      operation: 'subtract',
      prompt: 'Calcule la soustraction.',
      representation: 'column-grid',
      requiresCarry: false,
      requiresExchange: true,
      responseMode: 'column',
      right,
      skill: 'S5',
      solution: { alignment: [], type: 'column', value: left - right },
      zeroBridge: true,
    } as const satisfies Ce2Question
    renderCard(question)
    act(() => container.querySelector<HTMLButtonElement>('.ce2-card__help')?.click())

    for (const stage of stages) expect(container.textContent).toContain(stage)
  })

  it('reports column procedure only after every exact result digit and carry is shown', () => {
    const question = {
      ...common,
      family: 'column',
      id: 'a5-procedure',
      left: 678,
      mode: 'guided',
      module: 'arithmetic',
      operation: 'add',
      prompt: 'ce2.A5.column',
      representation: 'column-grid',
      requiresCarry: true,
      requiresExchange: false,
      responseMode: 'column',
      right: 459,
      skill: 'A5',
      solution: { alignment: [], type: 'column', value: 1137 },
      zeroBridge: false,
    } as const satisfies Ce2Question
    const incomplete = {
      ...freshDraft(question.id),
      carries: { hundreds: 1, tens: 1, thousands: 1 },
      columnEntries: {
        'result-hundreds': 1,
        'result-tens': 3,
        'result-thousands': 1,
        'result-units': 7,
      },
    }

    expect(ce2ColumnSteps(question, { ...incomplete, carries: { tens: 1 } })).toEqual([])
    expect(
      ce2ColumnSteps(question, {
        ...incomplete,
        carries: { ...incomplete.carries, units: 1 },
      }),
    ).toEqual([])
    expect(ce2ColumnSteps(question, incomplete)).toEqual([
      {
        column: 'units',
        exchangedFrom: null,
        incoming: 0,
        operation: 'add',
        outgoing: 1,
        resultDigit: 7,
      },
      {
        column: 'tens',
        exchangedFrom: null,
        incoming: 1,
        operation: 'add',
        outgoing: 1,
        resultDigit: 3,
      },
      {
        column: 'hundreds',
        exchangedFrom: null,
        incoming: 1,
        operation: 'add',
        outgoing: 1,
        resultDigit: 1,
      },
      {
        column: 'thousands',
        exchangedFrom: null,
        incoming: 1,
        operation: 'add',
        outgoing: 0,
        resultDigit: 1,
      },
    ])
  })

  it('rejects an extra exchange note in subtraction through zeros', () => {
    const question = {
      ...common,
      family: 'column',
      id: 's5-zero-bridge',
      left: 600,
      mode: 'guided',
      module: 'arithmetic',
      operation: 'subtract',
      prompt: 'ce2.S5.column',
      representation: 'column-grid',
      requiresCarry: false,
      requiresExchange: true,
      responseMode: 'column',
      right: 247,
      skill: 'S5',
      solution: { alignment: [], type: 'column', value: 353 },
      zeroBridge: true,
    } as const satisfies Ce2Question
    const exact = {
      ...freshDraft(question.id),
      borrows: { tens: 1, units: 1 },
      columnEntries: { 'result-hundreds': 3, 'result-tens': 5, 'result-units': 3 },
    }

    expect(ce2ColumnSteps(question, exact)).toHaveLength(3)
    expect(
      ce2ColumnSteps(question, { ...exact, borrows: { ...exact.borrows, hundreds: 1 } }),
    ).toEqual([])
  })

  it('orders three fractions with accessible step buttons', () => {
    const question = {
      ...common,
      family: 'ordering',
      id: 'f4-order',
      items: [
        { id: 'half', value: { denominator: 2, numerator: 1 } },
        { id: 'quarter', value: { denominator: 4, numerator: 1 } },
        { id: 'three-quarters', value: { denominator: 4, numerator: 3 } },
      ],
      prompt: 'ce2.F4.order',
      representation: 'bar',
      responseMode: 'ordering',
      skill: 'F4',
      solution: { orderedIds: ['quarter', 'half', 'three-quarters'], type: 'ordering' },
    } as const satisfies Ce2Question
    renderCard(question)

    const moveQuarterEarlier = container.querySelector<HTMLButtonElement>(
      '[aria-label="Déplacer 1/4 vers le plus petit"]',
    )
    act(() => moveQuarterEarlier?.click())

    expect(container.querySelector('.ce2-ordering li')?.textContent).toContain('14')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(false)
  })

  it('renders a separate typed result for each problem step', () => {
    const question = {
      ...common,
      family: 'problem',
      id: 'p2-steps',
      module: 'arithmetic',
      operations: ['add', 'subtract'],
      prompt: 'ce2.P2.two-steps',
      representation: 'part-whole',
      responseMode: 'problem',
      skill: 'P2',
      solution: {
        intermediateResults: [445],
        operation: null,
        type: 'problem',
        value: 365,
      },
      story: 'seed-reserve-two-steps',
      values: [320, 125, 80],
    } as const satisfies Ce2Question
    renderCard(question)

    expect(container.querySelectorAll('.ce2-problem__step')).toHaveLength(2)
    expect(container.textContent).toContain('Étape 1')
    expect(container.textContent).toContain('Étape 2')
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('.ce2-problem__step input'),
    )
    expect(inputs).toHaveLength(2)
    enter(inputs[0], '445')
    expect(inputs[0]?.value).toBe('445')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(true)
    enter(inputs[1], '365')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(false)
  })

  it('keeps an entered zero length denominator invalid instead of changing it to one', () => {
    const question = {
      ...common,
      family: 'length',
      fraction: { denominator: 4, numerator: 3 },
      id: 'f6-zero-denominator',
      prompt: 'Écris la longueur.',
      representation: 'unit-strip',
      responseMode: 'length',
      skill: 'F6',
      solution: { denominator: 4, numerator: 3, type: 'length', whole: 2 },
      wholeUnits: 2,
    } as const satisfies Ce2Question
    renderCard(question)
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement>('.ce2-length-entry input'),
    )
    enter(inputs[0], '2')
    enter(inputs[1], '3')
    enter(inputs[2], '0')

    expect(inputs[2]?.value).toBe('0')
    expect(container.querySelector<HTMLButtonElement>('.ce2-card__submit')?.disabled).toBe(true)
  })
})

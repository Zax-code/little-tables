import type { Exercise } from '@little-tables/domain'
import { describe, expect, it } from 'vitest'

import { columnSteps, firstWrongColumn } from './column-math.js'
import {
  expectedAnswerText,
  exerciseStatement,
  formatNumber,
  fractionInWords,
  isEquivalentForm,
  levelLabel,
  spokenPrompt,
} from './exercise-format.js'

describe('exercise formatting', () => {
  it('groups thousands with a full no-break space in French', () => {
    expect(formatNumber(4500, 'fr')).toBe('4 500')
    expect(formatNumber(4500, 'en')).toBe('4,500')
  })

  it('names fractions in words for screen readers', () => {
    expect(fractionInWords({ denominator: 4, numerator: 3 }, 'fr')).toBe('trois quarts')
    expect(fractionInWords({ denominator: 2, numerator: 1 }, 'fr')).toBe('un demi')
    expect(fractionInWords({ denominator: 4, numerator: 3, whole: 1 }, 'fr')).toBe(
      'une unité et trois quarts',
    )
    expect(fractionInWords({ denominator: 8, numerator: 5 }, 'en')).toBe('five eighths')
    expect(fractionInWords({ denominator: 4, numerator: 3 }, 'zh-Hans')).toBe('四分之三')
  })

  it('speaks a missing addend as a question', () => {
    const exercise: Exercise = {
      blank: 'right',
      choices: [],
      kind: 'arithmetic',
      left: 4,
      operation: 'add',
      resultFirst: false,
      right: 8,
      skill: 'addition-facts',
    }
    expect(spokenPrompt(exercise, 'fr')).toBe('4 plus combien égale 12')
    expect(exerciseStatement(exercise, 'fr')).toBe('4 + 8 = 12')
  })

  it('recognises an equivalent but differently written fraction', () => {
    const exercise: Exercise = {
      choices: [],
      kind: 'fraction-operation',
      left: { denominator: 2, numerator: 1 },
      operation: 'add',
      right: { denominator: 4, numerator: 1 },
      skill: 'fraction-operation',
      story: false,
    }
    expect(expectedAnswerText(exercise, 'fr')).toBe('3/4')
    expect(
      isEquivalentForm(exercise, { denominator: 8, numerator: 6, type: 'fraction', whole: 0 }),
    ).toBe(true)
  })

  it('labels every kind of level', () => {
    expect(levelLabel('add:3:8', 'fr')).toBe('3 + 8')
    expect(levelLabel('nearten:sub:29', 'fr')).toBe('− 29')
    expect(levelLabel('column:add:3d:carry-2', 'fr')).toBe(
      'addition posée · 3 chiffres · deux retenues',
    )
    expect(levelLabel('frac:equal:2-8', 'fr')).toBe('demis et huitièmes')
  })
})

describe('written calculations', () => {
  it('points at the first column that differs, from the units', () => {
    expect(firstWrongColumn(['8', '4', ''], 38)).toBe(1)
    expect(firstWrongColumn(['8', '3', ''], 38)).toBeNull()
    expect(firstWrongColumn(['8', '3', '0'], 38)).toBeNull()
  })

  it('walks a subtraction column by column with its exchanges', () => {
    const steps = columnSteps({
      kind: 'column',
      operation: 'subtract',
      skill: 'column-subtraction',
      terms: [201, 163],
    })
    expect(steps.map(({ exchange }) => exchange)).toEqual([true, true, false])
  })
})

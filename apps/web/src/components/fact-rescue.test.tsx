import type { PracticeQuestion } from '@little-tables/domain'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FactRescue } from './fact-rescue.js'

const question = (overrides: Partial<PracticeQuestion>): PracticeQuestion => ({
  answerMode: 'choice',
  choices: [],
  factKey: '2:10',
  id: 'question-1',
  left: 10,
  operation: 'multiply',
  right: 2,
  ...overrides,
})

describe('FactRescue', () => {
  it('builds a valid inverse fact from a multiplication question', () => {
    const markup = renderToStaticMarkup(<FactRescue question={question({})} strategies={[]} />)

    expect(markup).toContain('Quand tu connais 2 × 10 = 20, tu connais aussi 20 ÷ 2 = 10.')
    expect(markup).toContain('20 partagé en 2 groupes égaux')
  })

  it('preserves the fact family represented by a division question', () => {
    const markup = renderToStaticMarkup(
      <FactRescue
        question={question({ left: 20, operation: 'divide', right: 2 })}
        strategies={[]}
      />,
    )

    expect(markup).toContain('Quand tu connais 2 × 10 = 20, tu connais aussi 20 ÷ 2 = 10.')
    expect(markup).toContain('20 partagé en 2 groupes égaux')
  })
})

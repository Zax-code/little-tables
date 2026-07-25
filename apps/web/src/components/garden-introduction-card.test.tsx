import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { GardenIntroductionCard } from './garden-introduction-card.js'

describe('GardenIntroductionCard', () => {
  it('explains the daily bloom and permanent personal collection on a first visit', () => {
    const markup = renderToStaticMarkup(<GardenIntroductionCard onDismiss={vi.fn()} />)

    expect(markup).toContain('ton jardin pousse avec toi')
    expect(markup).toContain('une fleur par jour')
    expect(markup).toContain('ta collection')
    expect(markup).toContain('<button')
  })
})

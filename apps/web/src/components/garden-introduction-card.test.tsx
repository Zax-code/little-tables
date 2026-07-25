import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { GardenIntroductionCard } from './garden-introduction-card.js'

describe('GardenIntroductionCard', () => {
  it('explains the three-day watering rhythm on a first visit', () => {
    const markup = renderToStaticMarkup(<GardenIntroductionCard onDismiss={vi.fn()} />)

    expect(markup).toContain('ton jardin pousse avec toi')
    expect(markup).toContain('gagner un arrosage')
    expect(markup).toContain('Trois arrosages sur trois jours différents')
    expect(markup).toContain('Les jours de pause n’effacent aucun progrès')
    expect(markup).toContain('<button')
  })
})

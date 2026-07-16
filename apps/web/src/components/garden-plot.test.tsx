import { LearningEngine } from '@little-tables/domain'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GardenPlot } from './garden-plot.js'

describe('GardenPlot', () => {
  it('shows one named six-plant chapter at a time with finite three-page navigation', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 0,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const markup = renderToStaticMarkup(<GardenPlot progress={progress} />)

    expect(markup).toContain('les premières fleurs')
    expect(markup.match(/data-garden-page=/g)).toHaveLength(3)
    expect(markup.match(/data-plant-id=/g)).toHaveLength(18)
    expect(markup).toContain('Page 1 sur 3 du jardin')
  })

  it('uses natural French singular agreement for one collected flower', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 3,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const markup = renderToStaticMarkup(<GardenPlot progress={progress} />)

    expect(markup).toContain('1 fleur sur 6 dans ce coin')
    expect(markup).not.toContain('1 fleurs')
  })
})

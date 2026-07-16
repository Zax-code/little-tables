import { LearningEngine } from '@little-tables/domain'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { gardenPlantDefinition } from './garden-plant-catalog.js'
import { GardenPlot, PlantPages } from './garden-plot.js'

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

  it('keeps Miffy mounted inside her garden page while another garden is displayed', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 12,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const plants = progress.plants.map(gardenPlantDefinition)
    const pages = [plants.slice(0, 6), plants.slice(6, 12), plants.slice(12, 18)]
    const target = {
      caretakerX: 36,
      caretakerY: 39,
      facing: 'right' as const,
      id: plants[0]?.id ?? 'coral-tulip',
      pageIndex: 0,
      waterX: 188,
      waterY: 216,
    }
    const markup = renderToStaticMarkup(
      <PlantPages
        activePage={1}
        caretaker={{
          crossGardenJourney: undefined,
          phase: 'watering',
          target,
          walkDuration: 1,
          walkFacing: 'right',
        }}
        lastPage={2}
        onActivePageChange={() => undefined}
        pages={pages}
        pagesRef={createRef<HTMLDivElement>()}
        reduceMotion
      />,
    )
    const firstPageStart = markup.indexOf('data-garden-page="0"')
    const caretakerStart = markup.indexOf('garden-plot__caretaker')
    const secondPageStart = markup.indexOf('data-garden-page="1"')

    expect(firstPageStart).toBeGreaterThanOrEqual(0)
    expect(caretakerStart).toBeGreaterThan(firstPageStart)
    expect(caretakerStart).toBeLessThan(secondPageStart)
    expect(markup.match(/garden-plot__caretaker/g)).toHaveLength(1)
  })
})

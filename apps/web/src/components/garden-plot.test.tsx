import { LearningEngine } from '@little-tables/domain'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { gardenPlantDefinition } from './garden-plant-catalog.js'
import { GardenPlot, PlantPages } from './garden-plot.js'

describe('GardenPlot', () => {
  it('shows one named three-plant chapter at a time with finite three-page navigation', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 0,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const markup = renderToStaticMarkup(<GardenPlot progress={progress} />)

    expect(markup).toContain('les premières fleurs')
    expect(markup.match(/data-garden-page=/g)).toHaveLength(3)
    expect(markup.match(/data-plant-id=/g)).toHaveLength(9)
    expect(markup).toContain('Page 1 sur 3 du jardin')
  })

  it('uses natural French singular agreement for one collected flower', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 5,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const markup = renderToStaticMarkup(<GardenPlot progress={progress} />)

    expect(markup).toContain('1 fleur sur 3 dans ce coin')
    expect(markup).not.toContain('1 fleurs')
  })

  it('uses the approved full-length rose lotus stem from the rendered catalog', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 5,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const markup = renderToStaticMarkup(<GardenPlot progress={progress} />)

    expect(markup).toContain('data-plant-stem="rose-lotus-mature"')
    expect(markup).toContain('d="M70 154V100"')
    expect(markup).toContain('viewBox="0 0 112 152"')
  })

  it('uses box-centered icons for both garden navigation buttons', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 0,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const markup = renderToStaticMarkup(<GardenPlot progress={progress} />)

    expect(markup.match(/garden-plot__pagination-icon/g)).toHaveLength(2)
    expect(markup).not.toMatch(/[‹›]/u)
  })

  it('mounts Miffy once in the shared garden world while another garden is displayed', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 12,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const plants = progress.plants.map(gardenPlantDefinition)
    const pages = [plants.slice(0, 3), plants.slice(3, 6), plants.slice(6, 9)]
    const target = {
      caretakerX: 36,
      caretakerY: 39,
      facing: 'right' as const,
      id: plants[0]?.id ?? 'rose-lotus',
      pageIndex: 0,
      waterX: 188,
      waterY: 216,
    }
    const markup = renderToStaticMarkup(
      <PlantPages
        caretaker={{
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
    const worldStart = markup.indexOf('garden-plot__world')
    const firstPageStart = markup.indexOf('data-garden-page="0"')
    const lastPageStart = markup.indexOf('data-garden-page="2"')
    const caretakerStart = markup.indexOf('class="garden-plot__caretaker"')

    expect(worldStart).toBeGreaterThanOrEqual(0)
    expect(firstPageStart).toBeGreaterThanOrEqual(0)
    expect(caretakerStart).toBeGreaterThan(lastPageStart)
    expect(markup.match(/class="garden-plot__caretaker"/g)).toHaveLength(1)
  })

  it('keeps a measurable watering target on every pot so Miffy can mount', () => {
    const progress = LearningEngine.deriveGardenProgress({
      completedSessions: 45,
      snapshot: LearningEngine.emptySnapshot(),
    })
    const markup = renderToStaticMarkup(<GardenPlot progress={progress} />)

    expect(markup.match(/class="garden-plot__soil"/g)).toHaveLength(9)
  })
})

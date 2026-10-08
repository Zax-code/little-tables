import type { MeadowSilhouette, MeadowStage } from '@little-tables/engine/schema'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MeadowPlant } from './meadow-plant.js'

afterEach(cleanup)

const silhouettes: ReadonlyArray<MeadowSilhouette> = [
  'sunflower',
  'tulip',
  'daisy',
  'cosmos',
  'bellflower',
  'cornflower',
  'dahlia',
  'poppy',
  'anemone',
]

/** A light outline of the drawing: each shape and its fill, without the geometry. */
const outline = (silhouette: MeadowSilhouette, stage: MeadowStage) => {
  const { container } = render(<MeadowPlant verb={{ palette: 'rose', silhouette, stage }} />)
  const svg = container.querySelector('svg')
  expect(svg?.getAttribute('data-meadow-plant')).toBe(`${silhouette}-${stage}`)
  return [...(svg?.querySelectorAll('path, ellipse, rect') ?? [])].map(
    (shape) => `${shape.tagName.toLowerCase()} ${shape.getAttribute('fill') ?? ''}`,
  )
}

describe('the meadow flowers', () => {
  it.each(silhouettes)('draws the %s head in the verb’s palette', (silhouette) => {
    expect(outline(silhouette, 'mature')).toMatchSnapshot()
  })

  it('shares one bud and one seed between every family', () => {
    expect(outline('poppy', 'growing')).toEqual(outline('sunflower', 'growing'))
    expect(outline('poppy', 'seed')).toEqual(outline('daisy', 'seed'))
    expect(outline('poppy', 'seed')).toMatchSnapshot()
    expect(outline('poppy', 'growing')).toContain('path var(--meadow-rose-petal)')
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  GardenGrowingBud,
  GardenMatureHead,
  type GardenPlantKind,
} from './garden-plant-renderers.js'

const kinds: ReadonlyArray<GardenPlantKind> = [
  'rose-lotus',
  'twilight-lupine',
  'velvet-foxglove',
  'plum-snapdragon',
  'sunset-zinnia',
  'ruby-bleeding-heart',
  'blushing-peony',
  'ivory-magnolia',
  'blue-wisteria',
]

const colors = {
  accentColor: 'var(--garden-bloom-peach)',
  centerColor: 'var(--garden-center-russet)',
  petalColor: 'var(--garden-bloom-violet)',
} as const

describe('garden plant renderers', () => {
  it.each(kinds)('renders distinct growing and mature artwork for %s', (kind) => {
    const growing = renderToStaticMarkup(
      <svg>
        <GardenGrowingBud kind={kind} {...colors} />
      </svg>,
    )
    const mature = renderToStaticMarkup(
      <svg>
        <GardenMatureHead kind={kind} {...colors} />
      </svg>,
    )

    expect(growing).toContain(`garden-plot__flower--${kind}`)
    expect(mature).toContain(`garden-plot__flower--${kind}`)
    expect(growing).not.toBe(mature)
  })

  it('keeps every approved mature silhouette structurally distinct', () => {
    const silhouettes = kinds.map((kind) =>
      renderToStaticMarkup(
        <svg>
          <GardenMatureHead kind={kind} {...colors} />
        </svg>,
      ),
    )

    expect(new Set(silhouettes).size).toBe(kinds.length)
  })
})

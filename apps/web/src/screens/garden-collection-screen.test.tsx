import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LearningEngine } from '@little-tables/domain'

const bootstrapState = vi.hoisted<{ data: unknown }>(() => ({ data: undefined }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('../hooks/use-local-bootstrap.js', () => ({
  useLocalBootstrap: () => ({ data: bootstrapState.data, isLoading: false }),
}))

import { GardenCollectionScreen } from './garden-collection-screen.js'

describe('garden collection screen', () => {
  it('keeps every plant visible across three finite chapters, including locked discoveries', () => {
    bootstrapState.data = undefined
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenCollectionScreen />)

    expect(markup.match(/class="collection-chapter"/g)).toHaveLength(3)
    expect(markup.match(/class="collection-plant collection-plant--/g)).toHaveLength(9)
    expect(markup).toContain('href="/garden"')
  })

  it('distinguishes plants still hidden, currently growing, and already in bloom', () => {
    bootstrapState.data = {
      completedSessions: 16,
      snapshot: LearningEngine.emptySnapshot(),
    }
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenCollectionScreen />)

    expect(markup).toContain('collection-plant--locked')
    expect(markup).toContain('collection-plant--growing')
    expect(markup).toContain('collection-plant--mature')
    expect(markup).toContain('encore cachée')
    expect(markup).toContain('en train de pousser')
    expect(markup).toContain('bien éclose')
    expect(markup).not.toContain('{current}')
  })

  it('draws a visible foreground stem between an unlocked flower and its pot', () => {
    bootstrapState.data = {
      completedSessions: 5,
      snapshot: LearningEngine.emptySnapshot(),
    }
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenCollectionScreen />)
    const flowerIndex = markup.indexOf('garden-plot__flower--rose-lotus')
    const stemIndex = markup.indexOf('data-collection-stem="foreground"')
    const potIndex = markup.indexOf('class="collection-plant__pot"', flowerIndex)

    expect(flowerIndex).toBeGreaterThanOrEqual(0)
    expect(stemIndex).toBeGreaterThan(flowerIndex)
    expect(potIndex).toBeGreaterThan(stemIndex)
    expect(markup).toContain('transform="translate(0 -8)"')
    expect(markup).toContain('d="M56 86V68"')
  })
})

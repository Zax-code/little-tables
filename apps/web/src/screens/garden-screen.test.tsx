import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LearningEngine } from '@little-tables/domain'

const bootstrapState = vi.hoisted<{ data: unknown }>(() => ({ data: undefined }))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))

vi.mock('../components/garden-plot.js', () => ({
  GardenPlot: () => <div data-testid="garden-plot" />,
}))

vi.mock('../flower-transition.js', () => ({
  useFlowerTransition: () => (action: () => Promise<void>) => action(),
}))

vi.mock('../hooks/use-local-bootstrap.js', () => ({
  useLocalBootstrap: () => ({ data: bootstrapState.data, isLoading: false }),
}))

vi.mock('../store.js', () => ({
  localBootstrapQueryKey: ['local-bootstrap'],
  practiceStore: { startSession: vi.fn() },
}))

import { GardenScreen } from './garden-screen.js'

describe('garden screen', () => {
  it('renders the next garden step as a real action', () => {
    bootstrapState.data = undefined
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('<button')
    expect(markup).toContain('class="tomorrow-card"')
    expect(markup).toContain('type="button"')
  })

  it('offers the collection without adding another main tab and shows one daily moment', () => {
    bootstrapState.data = undefined
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('href="/garden/collection"')
    expect(markup.match(/class="garden-ambient-moment"/g)).toHaveLength(1)
  })

  it('labels after-watering practice as optional and non-rewarding', () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const todayKey = LearningEngine.learningDayKey({ at: new Date(), timeZone })
    bootstrapState.data = {
      activeSession: null,
      completedSessions: 1,
      gardenBloomCount: 1,
      rewardedDayKeys: [todayKey],
      snapshot: LearningEngine.emptySnapshot(),
    }
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('encore un peu, si le cœur t’en dit')
    expect(markup).toContain(
      'La fleur du jour est déjà au chaud. Cette petite séance, c’est juste pour toi.',
    )
    expect(markup).not.toContain('encore 1 fleur pour la voir éclore')
  })
})

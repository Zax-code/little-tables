import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LearningEngine, gardenFlowerIds } from '@little-tables/domain'

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
    expect(markup).toContain('class="garden-book-symbol"')
    expect(markup).not.toContain('▤')
    expect(markup.match(/class="garden-ambient-moment"/g)).toHaveLength(1)
  })

  it('shows the next flower goal and the exact once-per-day growth explanation', () => {
    bootstrapState.data = undefined
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('class="garden-next-goal"')
    expect(markup).toContain('ton prochain objectif au jardin')
    expect(markup).toContain('0 fleurs du jour sur 3')
    expect(markup).toContain('<details class="garden-how-it-grows"')
    expect(markup).toContain('Comment ça pousse')
    expect(markup).toContain('Le jardin pousse une fois par jour')
    expect(markup).toContain('la prochaine t’attend demain')
  })

  it('labels after-watering practice as optional and non-rewarding', () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const todayKey = LearningEngine.learningDayKey({ at: new Date(), timeZone })
    bootstrapState.data = {
      activeSession: null,
      completedSessions: 1,
      gardenBloomCount: 1,
      gardenCollection: { flowerOrder: gardenFlowerIds },
      rewardedDayKeys: [todayKey],
      snapshot: LearningEngine.emptySnapshot(),
    }
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('petite séance en plus · pas de fleur en plus aujourd’hui')
    expect(markup).toContain('La fleur du jour est bien au chaud et la prochaine t’attend demain.')
    expect(markup).toContain('rend tes calculs plus solides')
    expect(markup).not.toContain('encore 1 fleur pour la voir éclore')
  })

  it('explains a mastery gate in plain language and protects completed bloom progress', () => {
    bootstrapState.data = {
      activeSession: null,
      completedSessions: 9,
      gardenBloomCount: 9,
      gardenCollection: { flowerOrder: gardenFlowerIds },
      rewardedDayKeys: [],
      snapshot: LearningEngine.emptySnapshot(),
    }
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('Cette plante a déjà ses 3 fleurs.')
    expect(markup).toContain('5 multiplications sans aide')
    expect(markup).toContain('Ses fleurs restent bien au chaud.')
  })
})

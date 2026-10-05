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
  useNavigate: () => vi.fn(),
}))

vi.mock('../components/garden-plot.js', () => ({
  GardenPlot: () => <div data-testid="garden-plot" />,
}))

vi.mock('../hooks/use-local-bootstrap.js', () => ({
  useLocalBootstrap: () => ({ data: bootstrapState.data, isLoading: false }),
}))

import { GardenScreen } from './garden-screen.js'

describe('garden screen', () => {
  it('shows the primary garden goal without a duplicate lower practice action', () => {
    bootstrapState.data = undefined
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('class="garden-next-goal"')
    expect(markup).not.toContain('class="tomorrow-card"')
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
    expect(markup).toContain('Arrosages : 0 sur 3')
    expect(markup).toContain('<section class="garden-how-it-grows"')
    expect(markup).toContain('Comment ça pousse')
    expect(markup).toContain(
      'Termine la petite séance du jour pour obtenir un arrosage pour ta plante.',
    )
    expect(markup).toContain(
      'Le jardin avance une seule fois par jour : le prochain arrosage t’attend le lendemain. Une séance en plus rend tes calculs plus solides, mais ne donne pas un autre arrosage ce jour-là.',
    )
    expect(markup).toContain('La fleur en cours s’épanouit au bout de trois arrosages.')
    expect(markup).toContain('Une pause n’efface rien')
    expect(markup.match(/<li>/g)).toHaveLength(4)
    expect(markup).not.toContain('Les plantes arrivent dans un ordre')
  })

  it('shows that the growth explanation can be expanded and collapsed', () => {
    bootstrapState.data = undefined
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-controls="garden-how-it-grows-content"')
    expect(markup).toContain('id="garden-how-it-grows-content"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('class="garden-how-it-grows__indicator"')
    expect(markup).toContain('viewBox="0 0 16 16"')
  })

  it('explains a mastery gate in plain language and protects completed bloom progress', () => {
    bootstrapState.data = {
      activeSession: null,
      completedSessions: 9,
      gardenBloomCount: 9,
      gardenCollection: { flowerOrder: LearningEngine.gardenFlowerIds },
      rewardedDayKeys: [],
      snapshot: LearningEngine.emptySnapshot(),
    }
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('Les 3 arrosages de cette plante sont faits.')
    expect(markup).toContain('5 calculs sans aide')
    expect(markup).toContain('Ses progrès sont bien gardés.')
  })

  it.each([
    [7, 1, 'encore 2 arrosages'],
    [8, 2, 'encore un arrosage'],
  ])(
    'reports watering progress in the primary goal panel at bloom %i',
    (gardenBloomCount, currentBlooms, remainingCopy) => {
      bootstrapState.data = {
        activeSession: null,
        completedSessions: gardenBloomCount,
        gardenBloomCount,
        gardenCollection: { flowerOrder: LearningEngine.gardenFlowerIds },
        rewardedDayKeys: [],
        snapshot: LearningEngine.emptySnapshot(),
      }
      vi.stubGlobal('window', { location: { search: '' } })
      const markup = renderToStaticMarkup(<GardenScreen />)

      expect(markup).toContain(`Arrosages : ${currentBlooms} sur 3`)
      expect(markup).toContain(remainingCopy)
      expect(markup).not.toContain('3 fleurs')
    },
  )
})

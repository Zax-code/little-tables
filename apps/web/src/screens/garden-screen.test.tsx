import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('../components/garden-plot.js', () => ({
  GardenPlot: () => <div data-testid="garden-plot" />,
}))

vi.mock('../components/flower-transition.js', () => ({
  useFlowerTransition: () => (action: () => Promise<void>) => action(),
}))

vi.mock('../hooks/use-local-bootstrap.js', () => ({
  useLocalBootstrap: () => ({ data: undefined, isLoading: false }),
}))

vi.mock('../store.js', () => ({
  localBootstrapQueryKey: ['local-bootstrap'],
  practiceStore: { startSession: vi.fn() },
}))

import { GardenScreen } from './garden-screen.js'

describe('garden screen', () => {
  it('renders the next garden step as a real action', () => {
    vi.stubGlobal('window', { location: { search: '' } })
    const markup = renderToStaticMarkup(<GardenScreen />)

    expect(markup).toContain('<button')
    expect(markup).toContain('class="tomorrow-card"')
    expect(markup).toContain('type="button"')
  })
})

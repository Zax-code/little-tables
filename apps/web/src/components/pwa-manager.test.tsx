import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

import { PwaManager } from './pwa-manager.js'

describe('PwaManager', () => {
  it('keeps an available update visible and actionable', () => {
    const markup = renderToStaticMarkup(<PwaManager />)

    expect(markup).toContain('une toute nouvelle version est prête')
    expect(markup).toContain('mettre à jour')
    expect(markup).not.toContain('aria-label="Fermer"')
  })

  it('keeps the update waiting until a saved practice session has finished', () => {
    const markup = renderToStaticMarkup(<PwaManager practiceActive />)

    expect(markup).toContain('disabled=""')
    expect(markup).toContain('Termine ta séance')
    expect(markup).not.toContain('>mettre à jour<')
  })
})

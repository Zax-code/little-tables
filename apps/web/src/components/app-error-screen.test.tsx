import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { AppErrorScreen } from './app-error-screen.js'

describe('AppErrorScreen', () => {
  it('turns a route failure into a friendly update recovery screen', () => {
    const markup = renderToStaticMarkup(
      <AppErrorScreen
        error={new TypeError('MIME type mismatch')}
        info={{ componentStack: '' }}
        reset={vi.fn()}
      />,
    )

    expect(markup).toContain('/generated/miffy-update-recovery.webp')
    expect(markup).toContain('un tout petit arrêt au jardin')
    expect(markup).toContain('mettre à jour et rouvrir')
    expect(markup).not.toContain('MIME type mismatch')
  })
})

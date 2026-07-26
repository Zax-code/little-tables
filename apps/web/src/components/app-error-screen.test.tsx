import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { characterCatalog } from '../character-catalog.js'
import { SelectedCharacterContext } from '../selected-character-context.js'
import { AppErrorScreen } from './app-error-screen.js'

describe('AppErrorScreen', () => {
  it('turns a route failure into a friendly update recovery screen', () => {
    const markup = renderToStaticMarkup(
      <SelectedCharacterContext value={characterCatalog['mina-cat']}>
        <AppErrorScreen
          error={new TypeError('MIME type mismatch')}
          info={{ componentStack: '' }}
          reset={vi.fn()}
        />
      </SelectedCharacterContext>,
    )

    expect(markup).toContain('/characters/mina-cat/update-recovery.webp')
    expect(markup).toContain('Mina')
    expect(markup).toContain('un tout petit arrêt au jardin')
    expect(markup).toContain('mettre à jour et rouvrir')
    expect(markup.match(/<button/g)).toHaveLength(1)
    expect(markup).not.toContain('réessayer cet écran')
    expect(markup).not.toContain('MIME type mismatch')
  })
})

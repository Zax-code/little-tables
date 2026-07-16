import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Screen } from './screen.js'

describe('Screen', () => {
  it('marks a footerless screen as a standalone layout', () => {
    const markup = renderToStaticMarkup(<Screen footer={false}>sign in</Screen>)

    expect(markup).toContain('class="app-shell app-shell-standalone"')
    expect(markup).toContain('sign in')
  })
})

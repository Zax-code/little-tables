import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Screen } from './screen.js'

describe('Screen', () => {
  it('renders footerless content without navigation', () => {
    const markup = renderToStaticMarkup(<Screen footer={false}>sign in</Screen>)

    expect(markup).toContain('sign in')
    expect(markup).not.toContain('<nav')
  })
})

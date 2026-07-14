import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Screen } from './screen.js'

describe('Screen', () => {
  it('renders a footerless authentication screen without a router provider', () => {
    expect(renderToStaticMarkup(<Screen footer={false}>sign in</Screen>)).toContain('sign in')
  })
})

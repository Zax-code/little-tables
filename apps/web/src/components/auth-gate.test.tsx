import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GoogleConnectButtonArtwork } from './auth-gate.js'

describe('GoogleConnectButtonArtwork', () => {
  it('uses the generated Miffy face and app-styled connect copy', () => {
    const markup = renderToStaticMarkup(<GoogleConnectButtonArtwork />)

    expect(markup).toContain('/generated/miffy-google-connect.webp')
    expect(markup).toContain('se connecter avec google')
    expect(markup).toContain('aria-hidden="true"')
  })
})

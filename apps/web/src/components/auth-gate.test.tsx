import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GoogleConnectButtonArtwork, PreferredNameForm } from './auth-gate.js'

describe('GoogleConnectButtonArtwork', () => {
  it('uses the generated Miffy face and app-styled connect copy', () => {
    const markup = renderToStaticMarkup(<GoogleConnectButtonArtwork />)

    expect(markup).toContain('/characters/miffy/connect-profile.webp')
    expect(markup).toContain('se connecter avec google')
    expect(markup).toContain('aria-hidden="true"')
  })
})

describe('PreferredNameForm', () => {
  it('offers the Google name as the editable first-login default', () => {
    const markup = renderToStaticMarkup(
      <PreferredNameForm defaultName="Google Lou" onSave={() => Promise.resolve()} />,
    )

    expect(markup).toContain('comment veux-tu qu’on t’appelle ?')
    expect(markup).toContain('value="Google Lou"')
    expect(markup).toContain('placeholder="Google Lou"')
    expect(markup).toContain('maxLength="40"')
    expect(markup).toContain('/characters/miffy/home.webp')
  })
})

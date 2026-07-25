import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvatarPicker } from './family-screen.js'

describe('family management screen', () => {
  it('offers approved characters rather than color variants', () => {
    const markup = renderToStaticMarkup(
      <AvatarPicker name="avatar" onChange={() => undefined} value="sprout" />,
    )

    expect(markup.match(/type="radio"/g)).toHaveLength(6)
    expect(markup).toContain('value="sprout"')
    expect(markup).toContain('value="malo-bear"')
    expect(markup).toContain('value="fenna-fox"')
    expect(markup).toContain('value="mina-cat"')
    expect(markup).toContain('value="paco-dog"')
    expect(markup).toContain('value="colin-mallard"')
    expect(markup).toContain('checked=""')
    expect(markup.match(/class="avatar-picker__name"/g)).toHaveLength(6)
    expect(markup).toContain('class="avatar-picker__check"')
    expect(markup).toContain('>Miffy<')
    expect(markup).toContain('>Malo<')
    expect(markup).toContain('>Fenna<')
    expect(markup).toContain('>Mina<')
    expect(markup).toContain('>Paco<')
    expect(markup).toContain('>Colin<')
    expect(markup).not.toContain('ourson')
    expect(markup).not.toContain('renard')
    expect(markup).not.toContain('chat')
    expect(markup).not.toContain('chien')
    expect(markup).not.toContain('canard')
    expect(markup).not.toContain('corail')
    expect(markup).not.toContain('sauge')
  })

  it('shows a safe Miffy fallback for retired avatar IDs without exposing rejected artwork', () => {
    const markup = renderToStaticMarkup(<AvatarPicker defaultValue="berry" name="legacy-avatar" />)

    expect(markup.match(/type="radio"/g)).toHaveLength(6)
    expect(markup).toContain('value="sprout"')
    expect(markup).not.toContain('value="berry"')
    expect(markup).toContain('checked=""')
    expect(markup).toContain('>Miffy<')
    expect(markup).not.toContain('Pollen la souris')
    expect(markup).not.toContain('baie')
    expect(markup).not.toContain('bluebell')
  })
})

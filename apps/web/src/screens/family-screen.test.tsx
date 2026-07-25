import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvatarPicker } from './family-screen.js'

describe('family management screen', () => {
  it('offers every preset avatar as a named radio selection', () => {
    const markup = renderToStaticMarkup(
      <AvatarPicker name="avatar" onChange={() => undefined} value="bluebell" />,
    )

    expect(markup.match(/type="radio"/g)).toHaveLength(4)
    expect(markup).toContain('value="sprout"')
    expect(markup).toContain('value="sunbeam"')
    expect(markup).toContain('value="bluebell"')
    expect(markup).toContain('value="berry"')
    expect(markup).toContain('checked=""')
  })
})

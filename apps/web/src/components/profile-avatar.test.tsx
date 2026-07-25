import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ProfileAvatar } from './profile-avatar.js'

describe('ProfileAvatar', () => {
  it('renders the exact selected Miffy or Pip character variant for each stable preset', () => {
    const markup = renderToStaticMarkup(
      <>
        <ProfileAvatar avatarId="sprout" />
        <ProfileAvatar avatarId="sunbeam" />
        <ProfileAvatar avatarId="bluebell" />
        <ProfileAvatar avatarId="berry" />
      </>,
    )

    expect(markup.match(/class="profile-avatar__miffy"/g)).toHaveLength(2)
    expect(markup.match(/class="profile-avatar__mouse"/g)).toHaveLength(2)
    expect(markup).toContain('/generated/miffy-google-connect.webp')
    expect(markup).toContain('data-avatar-character="miffy"')
    expect(markup).toContain('data-avatar-variant="coral"')
    expect(markup).toContain('data-avatar-variant="sunshine"')
    expect(markup).toContain('data-avatar-character="pip-mouse"')
    expect(markup).toContain('data-avatar-variant="sage"')
    expect(markup).toContain('data-avatar-variant="berry"')
  })
})

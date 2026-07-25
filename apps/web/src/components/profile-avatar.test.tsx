import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ProfileAvatar } from './profile-avatar.js'

describe('ProfileAvatar', () => {
  it('renders one unchanged appearance per character while preserving legacy IDs', () => {
    const markup = renderToStaticMarkup(
      <>
        <ProfileAvatar avatarId="sprout" />
        <ProfileAvatar avatarId="malo-bear" />
        <ProfileAvatar avatarId="fenna-fox" />
        <ProfileAvatar avatarId="mina-cat" />
        <ProfileAvatar avatarId="paco-dog" />
        <ProfileAvatar avatarId="colin-mallard" />
      </>,
    )

    expect(markup.match(/class="profile-avatar__miffy"/g)).toHaveLength(1)
    expect(markup.match(/class="profile-avatar__character"/g)).toHaveLength(5)
    expect(markup).toContain('/avatars/miffy.png')
    expect(markup).toContain('/avatars/malo-bear.png')
    expect(markup).toContain('/avatars/fenna-fox.png')
    expect(markup).toContain('/avatars/mina-cat.png')
    expect(markup).toContain('/avatars/paco-dog.png')
    expect(markup).toContain('/avatars/colin-mallard.png')
    expect(markup).toContain('data-avatar-character="miffy"')
    expect(markup).toContain('data-avatar-character="malo"')
    expect(markup).toContain('data-avatar-character="fenna"')
    expect(markup).toContain('data-avatar-character="mina"')
    expect(markup).toContain('data-avatar-character="paco"')
    expect(markup).toContain('data-avatar-character="colin"')
    expect(markup).not.toContain('data-avatar-variant')
    expect(markup).not.toContain('<svg')
    expect(markup).not.toContain('style=')
  })
})

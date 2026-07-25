import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('../use-family-profile.js', () => ({
  useFamilyProfile: () => ({
    activeProfile: { avatarId: 'bluebell', id: 'member-one', name: 'Camille' },
    profiles: [{ avatarId: 'bluebell', id: 'member-one', name: 'Camille' }],
    switchProfile: vi.fn(),
  }),
}))

import { ProfileSwitcher } from './profile-switcher.js'

describe('ProfileSwitcher', () => {
  it('names the current family member inclusively and displays their saved avatar', () => {
    const markup = renderToStaticMarkup(<ProfileSwitcher />)

    expect(markup).toContain(
      'aria-label="Membre actuel de la famille : Camille. Changer de profil"',
    )
    expect(markup).toContain('profile-avatar-bluebell')
    expect(markup).not.toContain('Enfant')
  })
})

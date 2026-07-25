import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

type LinkProps = ComponentProps<'a'> & Readonly<{ preload?: string; to: string }>

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, preload: _preload, to, ...props }: LinkProps) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: () => '/stats',
}))

vi.mock('../flower-transition.js', () => ({
  useFlowerTransition: () => vi.fn(),
}))

vi.mock('../i18n.js', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../use-family-profile.js', () => ({
  useFamilyProfile: () => ({
    activeProfile: { avatarId: 'sprout', id: 'lou', name: 'Lou' },
    profiles: [{ avatarId: 'sprout', id: 'lou', name: 'Lou' }],
    switchProfile: vi.fn(),
  }),
}))

import { BottomNav } from './bottom-nav.js'

describe('BottomNav', () => {
  it('identifies every tab for its own visual state and marks the current destination', () => {
    const markup = renderToStaticMarkup(<BottomNav />)

    expect(markup).toContain('data-nav-tab="home"')
    expect(markup).toContain('data-nav-tab="garden"')
    expect(markup).toContain('data-nav-tab="stats"')
    expect(markup).toContain('href="/stats" aria-current="page"')
    expect(markup).toContain('class="profile-switcher-button"')
    expect(markup).toContain('Lou')
  })
})

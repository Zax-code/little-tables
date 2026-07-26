// @vitest-environment happy-dom

import type { ChildProfile } from '@little-tables/domain'
import { act, createElement, type ReactNode, useCallback, useMemo, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

const { preloadImageSourcesSpy } = vi.hoisted(() => ({
  preloadImageSourcesSpy: vi.fn(() => Promise.resolve()),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: ({ select }: Readonly<{ select: (location: { pathname: string }) => string }>) =>
    select({ pathname: '/practice' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('../preload-images.js', () => ({
  preloadImageSources: preloadImageSourcesSpy,
}))

vi.mock('motion/react', () => {
  const withoutMotionProps = ({
    animate: _animate,
    exit: _exit,
    initial: _initial,
    transition: _transition,
    ...props
  }: Readonly<Record<string, unknown>>) => props
  const motionElement =
    (tag: 'div' | 'span') =>
    ({ children, ...props }: Readonly<{ children?: ReactNode } & Record<string, unknown>>) =>
      createElement(tag, withoutMotionProps(props), children)
  return {
    AnimatePresence: ({ children }: Readonly<{ children: ReactNode }>) => children,
    m: { div: motionElement('div'), span: motionElement('span') },
    useReducedMotion: () => false,
  }
})

import { FamilyProfileContext } from '../family-profile-context.js'
import { profileSwitchDelay } from './profile-switch-transition.js'
import { ProfileSwitcher } from './profile-switcher.js'

const profiles = [
  { avatarId: 'bluebell', id: 'member-one', name: 'Camille' },
  { avatarId: 'paco-dog', id: 'member-two', name: 'Zak' },
] as const satisfies ReadonlyArray<ChildProfile>

describe('ProfileSwitcher', () => {
  let container: HTMLDivElement
  let root: Root
  let switchProfileSpy: Mock<(profileId: string) => void>

  function Harness() {
    const [activeProfile, setActiveProfile] = useState<ChildProfile>(profiles[0])
    const switchProfile = useCallback((profileId: string) => {
      switchProfileSpy(profileId)
      const selected = profiles.find(({ id }) => id === profileId)
      if (selected !== undefined) setActiveProfile(selected)
    }, [])
    const value = useMemo(
      () => ({ activeProfile, profiles, switchProfile }),
      [activeProfile, switchProfile],
    )
    return <FamilyProfileContext value={value}>{<ProfileSwitcher />}</FamilyProfileContext>
  }

  beforeEach(() => {
    vi.useFakeTimers()
    switchProfileSpy = vi.fn()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root.render(<Harness />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it('briefly locks switching, preloads the target art, and settles on saved identity', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('.profile-switcher-button')
    if (trigger === null) throw new Error('Missing profile switcher trigger')
    expect(trigger.getAttribute('aria-label')).toBe(
      'Membre actuel de la famille : Camille. Changer de profil',
    )
    expect(
      container.querySelector('.profile-switcher-current')?.getAttribute('data-profile-id'),
    ).toBe('member-one')

    act(() => trigger.click())
    const target = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    ).find((button) => button.textContent.trim() === 'Zak')
    if (target === undefined) throw new Error('Missing alternate family member')
    act(() => target.click())

    expect(trigger.disabled).toBe(true)
    expect(container.querySelector('.profile-switch-feedback')?.textContent).toContain(
      'Changement de profil vers Zak…',
    )
    expect(preloadImageSourcesSpy).toHaveBeenCalledWith([
      '/characters/paco-dog/practice-idle.webp',
      '/characters/paco-dog/practice-correct.webp',
      '/characters/paco-dog/practice-encourage.webp',
    ])
    act(() => {
      vi.advanceTimersByTime(89)
    })
    expect(switchProfileSpy).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(switchProfileSpy).toHaveBeenCalledExactlyOnceWith('member-two')
    expect(
      container.querySelector('.profile-switcher-current')?.getAttribute('data-profile-id'),
    ).toBe('member-two')
    expect(container.querySelector('.sr-only')?.textContent).toBe('Profil actif : Zak.')
    expect(container.querySelector('.profile-avatar-paco-dog')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(240)
    })
    expect(trigger.disabled).toBe(false)
    expect(container.querySelector('.profile-switch-feedback')).toBeNull()
  })

  it('removes both transition delays when reduced motion is requested', () => {
    expect(profileSwitchDelay('commit', true)).toBe(0)
    expect(profileSwitchDelay('finish', true)).toBe(0)
    expect(profileSwitchDelay('commit', false)).toBeLessThan(100)
    expect(profileSwitchDelay('finish', false)).toBeLessThan(300)
  })
})

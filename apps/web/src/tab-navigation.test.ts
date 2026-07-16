import { describe, expect, it, vi } from 'vitest'

import { transitionBetweenTabs } from './tab-navigation.js'

const plainClick = () => ({
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  preventDefault: vi.fn(),
  shiftKey: false,
})

describe('tab navigation', () => {
  it('reveals the next tab through a transition', async () => {
    const event = plainClick()
    const navigate = vi.fn()
    const transition = vi.fn(async (action: () => Promise<void> | void) => action())

    await expect(
      transitionBetweenTabs({
        currentPath: '/',
        event,
        navigate,
        nextPath: '/garden',
        transition,
      }),
    ).resolves.toBe(true)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(transition).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledOnce()
  })

  it('leaves modified clicks available to the browser', async () => {
    const event = { ...plainClick(), metaKey: true }
    const transition = vi.fn()

    await expect(
      transitionBetweenTabs({
        currentPath: '/',
        event,
        navigate: vi.fn(),
        nextPath: '/garden',
        transition,
      }),
    ).resolves.toBe(false)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(transition).not.toHaveBeenCalled()
  })
})

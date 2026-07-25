import { afterEach, describe, expect, it, vi } from 'vitest'

import { persistLocalePreference, readLocalePreference } from './locale-preference.js'

describe('locale preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists and restores a Simplified Chinese selection', () => {
    const getItem = vi.fn(() => 'zh-Hans')
    const setItem = vi.fn()
    vi.stubGlobal('window', {
      localStorage: { getItem, setItem },
    })

    expect(readLocalePreference()).toBe('zh-Hans')
    persistLocalePreference('zh-Hans')

    expect(getItem).toHaveBeenCalledWith('little-tables:locale')
    expect(setItem).toHaveBeenCalledWith('little-tables:locale', 'zh-Hans')
  })

  it('keeps French as the safe default when browser storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('storage unavailable')
        },
      },
    })

    expect(readLocalePreference()).toBe('fr')
  })
})

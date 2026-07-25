import { afterEach, describe, expect, it, vi } from 'vitest'

import { selectLanguage } from './language-selection.js'
import { applyLocalePreference } from './locale-preference.js'
import type { Locale } from './i18n.js'

describe('language selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates, persists, and synchronizes a Simplified Chinese selection', () => {
    const setItem = vi.fn()
    vi.stubGlobal('window', {
      localStorage: { setItem },
    })
    let activeLocale: Locale = 'fr'
    const updateLocale = vi.fn((locale: Locale) => {
      activeLocale = locale
    })
    const syncReminderLocale = vi.fn(() => Promise.resolve())

    selectLanguage(
      'zh-Hans',
      (locale) => applyLocalePreference(locale, updateLocale),
      syncReminderLocale,
    )

    expect(activeLocale).toBe('zh-Hans')
    expect(setItem).toHaveBeenCalledWith('little-tables:locale', 'zh-Hans')
    expect(syncReminderLocale).toHaveBeenCalledWith('zh-Hans')
  })
})

// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const syncExistingReminderLocale = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('../reminder-subscription.js', () => ({
  syncExistingReminderLocale,
}))

vi.mock('../use-family-profile.js', () => ({
  useFamilyProfile: () => ({
    activeProfile: { avatarId: 'sprout', id: 'lou', name: 'Lou' },
  }),
}))

import { I18nProvider } from '../i18n.js'
import { LanguageToggle } from './language-toggle.js'

describe('LanguageToggle', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('offers English, French, and Simplified Chinese together', () => {
    const frenchMarkup = renderToStaticMarkup(<LanguageToggle />)
    const englishMarkup = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <LanguageToggle />
      </I18nProvider>,
    )
    const chineseMarkup = renderToStaticMarkup(
      <I18nProvider initialLocale="zh-Hans">
        <LanguageToggle />
      </I18nProvider>,
    )

    expect(frenchMarkup).toContain('aria-label="Choisir la langue"')
    expect(frenchMarkup).toContain('value="en">English')
    expect(frenchMarkup).toContain('value="fr" selected="">Français')
    expect(frenchMarkup).toContain('value="zh-Hans">简体中文')
    expect(englishMarkup).toContain('aria-label="Choose language"')
    expect(englishMarkup).toContain('value="en" selected="">English')
    expect(chineseMarkup).toContain('aria-label="选择语言"')
    expect(chineseMarkup).toContain('value="zh-Hans" selected="">简体中文')
  })

  it('restores a persisted Simplified Chinese choice', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => 'zh-Hans'),
      },
    })

    const markup = renderToStaticMarkup(
      <I18nProvider>
        <LanguageToggle />
      </I18nProvider>,
    )

    expect(markup).toContain('aria-label="选择语言"')
    expect(markup).toContain('value="zh-Hans" selected="">简体中文')
  })

  it('persists Chinese and updates the active family member reminder', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const setItem = vi.spyOn(window.localStorage, 'setItem')

    act(() => {
      root.render(
        <I18nProvider initialLocale="fr">
          <LanguageToggle />
        </I18nProvider>,
      )
    })
    const selector = container.querySelector('select')
    if (selector === null) throw new Error('Missing language selector')

    await act(async () => {
      selector.value = 'zh-Hans'
      selector.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })

    expect(setItem).toHaveBeenCalledWith('little-tables:locale', 'zh-Hans')
    expect(syncExistingReminderLocale).toHaveBeenCalledWith('zh-Hans', 'lou')
    expect(selector.getAttribute('aria-label')).toBe('选择语言')

    act(() => root.unmount())
    container.remove()
  })
})

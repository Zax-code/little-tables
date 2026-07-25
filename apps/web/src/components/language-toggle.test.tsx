import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../use-family-profile.js', () => ({
  useFamilyProfile: () => ({
    activeProfile: { avatarId: 'sprout', id: 'lou', name: 'Lou' },
  }),
}))

import { I18nProvider } from '../i18n.js'
import { LanguageToggle } from './language-toggle.js'

describe('LanguageToggle', () => {
  it('offers the other supported language', () => {
    const frenchMarkup = renderToStaticMarkup(<LanguageToggle />)
    const englishMarkup = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <LanguageToggle />
      </I18nProvider>,
    )

    expect(frenchMarkup).toContain('aria-label="Passer en anglais"')
    expect(frenchMarkup).toContain('>EN<')
    expect(englishMarkup).toContain('aria-label="Switch to French"')
    expect(englishMarkup).toContain('>FR<')
  })
})

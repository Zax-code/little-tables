import { describe, expect, it } from 'vitest'

import { resolveLocale, translate } from './i18n.js'

describe('internationalization', () => {
  it('defaults to French while preserving an explicit supported locale', () => {
    expect(resolveLocale(null)).toBe('fr')
    expect(resolveLocale('de')).toBe('fr')
    expect(resolveLocale('en')).toBe('en')
  })

  it('writes warm, accented French copy with interpolated values', () => {
    expect(translate('fr', 'home.firstVisitHeading', { name: 'léa' })).toBe('coucou, léa ♡')
    expect(translate('fr', 'home.firstVisitIntro')).toBe(
      'on va trouver par où commencer, tout doucement.',
    )
    expect(translate('fr', 'practice.almost', { answer: 42 })).toBe('presque — c’était 42')
  })
})

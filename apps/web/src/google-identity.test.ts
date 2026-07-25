import { describe, expect, it } from 'vitest'

import { googleIdentityLocale } from './google-identity.js'

describe('Google Identity locale', () => {
  it('adapts the app locale to Google’s Simplified Chinese locale code', () => {
    expect(googleIdentityLocale('en')).toBe('en')
    expect(googleIdentityLocale('fr')).toBe('fr')
    expect(googleIdentityLocale('zh-Hans')).toBe('zh_CN')
  })
})

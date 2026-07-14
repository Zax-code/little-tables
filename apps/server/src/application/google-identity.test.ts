import { describe, expect, it } from 'vitest'

import { authorizeGoogleClaims } from './google-identity.js'

describe('authorizeGoogleClaims', () => {
  it('accepts the configured verified Google account case-insensitively', () => {
    expect(
      authorizeGoogleClaims(
        {
          email: 'BELMUDESLEA@GMAIL.COM',
          email_verified: true,
          given_name: 'LÉA',
          sub: 'google-account-id',
        },
        ['boosmlang.a@gmail.com', 'belmudeslea@gmail.com'],
      ),
    ).toEqual({ displayName: 'léa', profileId: 'lou', subject: 'google-account-id' })
  })

  it('accepts either configured Google account', () => {
    expect(
      authorizeGoogleClaims(
        {
          email: 'boosmlang.a@gmail.com',
          email_verified: true,
          given_name: 'BOO',
          sub: 'second-google-account-id',
        },
        ['boosmlang.a@gmail.com', 'belmudeslea@gmail.com'],
      ),
    ).toEqual({ displayName: 'boo', profileId: 'lou', subject: 'second-google-account-id' })
  })

  it.each([
    { email: 'somebody@example.com', email_verified: true, sub: 'other-account' },
    { email: 'lea@example.com', email_verified: false, sub: 'google-account-id' },
    { email: 'lea@example.com', email_verified: true },
  ])('rejects unapproved, unverified, or unidentified accounts', (claims) => {
    expect(
      authorizeGoogleClaims(claims, ['boosmlang.a@gmail.com', 'belmudeslea@gmail.com']),
    ).toBeNull()
  })
})

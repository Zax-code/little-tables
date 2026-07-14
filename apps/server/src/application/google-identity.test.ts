import { describe, expect, it } from 'vitest'

import { authorizeGoogleClaims } from './google-identity.js'

describe('authorizeGoogleClaims', () => {
  it('accepts the configured verified Google account case-insensitively', () => {
    expect(
      authorizeGoogleClaims(
        {
          email: 'Lea@Example.com',
          email_verified: true,
          given_name: 'LÉA',
          sub: 'google-account-id',
        },
        'lea@example.com',
      ),
    ).toEqual({ displayName: 'léa', profileId: 'lou', subject: 'google-account-id' })
  })

  it.each([
    { email: 'somebody@example.com', email_verified: true, sub: 'other-account' },
    { email: 'lea@example.com', email_verified: false, sub: 'google-account-id' },
    { email: 'lea@example.com', email_verified: true },
  ])('rejects unapproved, unverified, or unidentified accounts', (claims) => {
    expect(authorizeGoogleClaims(claims, 'lea@example.com')).toBeNull()
  })
})

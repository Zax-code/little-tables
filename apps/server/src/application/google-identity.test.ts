import { describe, expect, it } from 'vitest'

import { googleIdentityFromClaims } from './google-identity.js'

describe('googleIdentityFromClaims', () => {
  it('returns a canonical email for a verified Google account', () => {
    expect(
      googleIdentityFromClaims({
        email: ' BOOMSLANG.A@GMAIL.COM ',
        email_verified: true,
        given_name: 'OWNER',
        sub: 'google-account-id',
      }),
    ).toEqual({
      displayName: 'owner',
      email: 'boomslang.a@gmail.com',
      profileId: 'lou',
      subject: 'google-account-id',
    })
  })

  it.each([
    { email: 'lea@example.com', email_verified: false, sub: 'google-account-id' },
    { email: 'lea@example.com', email_verified: true },
  ])('rejects unverified or unidentified accounts', (claims) => {
    expect(googleIdentityFromClaims(claims)).toBeNull()
  })
})

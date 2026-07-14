import { describe, expect, it } from 'vitest'

import { Identity } from './identity.js'

describe('Identity', () => {
  it('claims a valid invite and rejects tampered or expired sessions', () => {
    const now = new Date('2026-07-12T12:00:00.000Z')
    const session = Identity.claim({
      expectedInvite: 'a-private-invite',
      invite: 'a-private-invite',
      now,
      secret: 'a-session-secret-long-enough',
    })

    expect(session).not.toBeNull()
    expect(
      Identity.verify({
        now: new Date('2026-07-13T12:00:00.000Z'),
        secret: 'a-session-secret-long-enough',
        session: session ?? '',
      }),
    ).toEqual({ displayName: 'léa', profileId: 'lou' })
    expect(
      Identity.verify({
        now,
        secret: 'a-session-secret-long-enough',
        session: `${session ?? ''}tampered`,
      }),
    ).toBeNull()
    expect(
      Identity.verify({
        now: new Date('2026-08-20T12:00:00.000Z'),
        secret: 'a-session-secret-long-enough',
        session: session ?? '',
      }),
    ).toBeNull()
  })

  it('issues a valid session for an externally verified identity', () => {
    const now = new Date('2026-07-12T12:00:00.000Z')
    const session = Identity.issue({
      displayName: 'lea',
      now,
      profileId: 'lou',
      secret: 'a-session-secret-long-enough',
    })

    expect(Identity.verify({ now, secret: 'a-session-secret-long-enough', session })).toEqual({
      displayName: 'lea',
      profileId: 'lou',
    })
  })
})

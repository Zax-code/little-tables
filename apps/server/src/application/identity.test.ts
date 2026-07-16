import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { Identity } from './identity.js'

const secret = 'a-session-secret-long-enough'

const legacySession = (now: Date): string => {
  const payload = Buffer.from(
    JSON.stringify({ displayName: 'léa', expiresAt: now.getTime() + 60_000, profileId: 'lou' }),
  ).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

describe('Identity', () => {
  it('issues and renews Google-authenticated sessions', () => {
    const now = new Date('2026-07-12T12:00:00.000Z')
    const session = Identity.issue({
      authMethod: 'google',
      displayName: 'lea',
      email: 'boomslang.a@gmail.com',
      googleSubject: 'google-account-id',
      now,
      profileId: 'lou',
      secret,
    })
    const identity = {
      authMethod: 'google',
      displayName: 'lea',
      email: 'boomslang.a@gmail.com',
      expiresAt: new Date('2026-08-11T12:00:00.000Z').getTime(),
      googleSubject: 'google-account-id',
      profileId: 'lou',
      sessionVersion: 0,
    }

    expect(Identity.verify({ now, secret, session })).toEqual(identity)
    const renewed = Identity.renew({ now: new Date(now.getTime() + 1_000), secret, session })
    expect(Identity.verify({ now, secret, session: renewed ?? '' })).toEqual({
      ...identity,
      expiresAt: identity.expiresAt + 1_000,
    })
  })

  it('rejects legacy, tampered, and expired sessions', () => {
    const now = new Date('2026-07-12T12:00:00.000Z')
    const session = Identity.issue({
      authMethod: 'google',
      displayName: 'lea',
      email: 'boomslang.a@gmail.com',
      googleSubject: 'google-account-id',
      now,
      profileId: 'lou',
      secret,
    })

    expect(Identity.verify({ now, secret, session: legacySession(now) })).toBeNull()
    expect(Identity.verify({ now, secret, session: `${session}tampered` })).toBeNull()
    expect(
      Identity.verify({
        now: new Date('2026-08-20T12:00:00.000Z'),
        secret,
        session,
      }),
    ).toBeNull()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import {
  authStatusFromOfflineGrant,
  persistOfflineAuthGrant,
  readOfflineAuthGrant,
} from './offline-auth.js'

const now = new Date('2026-07-14T12:00:00.000Z').getTime()

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('offline authentication grant', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('persists a current server-verified Google session for offline use', () => {
    const status = {
      authenticated: true,
      authenticationRequired: true,
      displayName: 'léa',
      googleClientId: 'client.apps.googleusercontent.com',
      isAdmin: true,
      nameChoiceRequired: true,
      profileId: 'verified-child',
      sessionExpiresAt: now + 60_000,
    } as const

    expect(persistOfflineAuthGrant(status, storage, now)).toEqual({
      displayName: 'léa',
      expiresAt: now + 60_000,
      nameChoiceRequired: true,
      profileId: 'verified-child',
    })
    const grant = readOfflineAuthGrant(storage, now)
    expect(grant).toEqual({
      displayName: 'léa',
      expiresAt: now + 60_000,
      nameChoiceRequired: true,
      profileId: 'verified-child',
    })
    expect(grant && authStatusFromOfflineGrant(grant)).toMatchObject({
      authenticated: true,
      displayName: 'léa',
      isAdmin: false,
      nameChoiceRequired: true,
      profileId: 'verified-child',
      sessionExpiresAt: now + 60_000,
    })
  })

  it('clears the grant when the server reports signed-out', () => {
    persistOfflineAuthGrant(
      {
        authenticated: true,
        authenticationRequired: true,
        displayName: 'léa',
        googleClientId: 'client.apps.googleusercontent.com',
        isAdmin: false,
        nameChoiceRequired: false,
        sessionExpiresAt: now + 60_000,
      },
      storage,
      now,
    )

    persistOfflineAuthGrant(
      {
        authenticated: false,
        authenticationRequired: true,
        displayName: null,
        googleClientId: 'client.apps.googleusercontent.com',
        isAdmin: false,
        nameChoiceRequired: false,
        sessionExpiresAt: null,
      },
      storage,
      now,
    )

    expect(readOfflineAuthGrant(storage, now)).toBeNull()
  })

  it('rejects and removes expired or malformed grants', () => {
    storage.setItem(
      'little-tables-google-session-v1',
      JSON.stringify({ displayName: 'léa', expiresAt: now }),
    )
    expect(readOfflineAuthGrant(storage, now)).toBeNull()
    expect(storage.values.size).toBe(0)

    storage.setItem('little-tables-google-session-v1', '{bad json')
    expect(readOfflineAuthGrant(storage, now)).toBeNull()

    storage.setItem(
      'little-tables-google-session-v1',
      JSON.stringify({
        displayName: 'léa',
        expiresAt: now + 60_000,
        nameChoiceRequired: 'yes',
      }),
    )
    expect(readOfflineAuthGrant(storage, now)).toBeNull()
  })
})

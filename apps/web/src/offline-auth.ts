import { Either, Schema } from 'effect'

import type { AuthStatus } from './auth-client.js'

const offlineAuthKey = 'little-tables-google-session-v1'

type GrantStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

const OfflineAuthGrantSchema = Schema.Struct({
  displayName: Schema.NonEmptyTrimmedString,
  expiresAt: Schema.Number.pipe(Schema.finite()),
  nameChoiceRequired: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

export type OfflineAuthGrant = typeof OfflineAuthGrantSchema.Type

const validGrant = (value: unknown, now: number): OfflineAuthGrant | null => {
  const decoded = Schema.decodeUnknownEither(OfflineAuthGrantSchema)(value)
  if (Either.isLeft(decoded) || decoded.right.expiresAt <= now) return null
  return decoded.right
}

export const offlineGrantFromAuthStatus = (
  status: AuthStatus,
  now = Date.now(),
): OfflineAuthGrant | null =>
  status.authenticationRequired && status.authenticated
    ? validGrant(
        {
          displayName: status.displayName,
          expiresAt: status.sessionExpiresAt,
          nameChoiceRequired: status.nameChoiceRequired,
        },
        now,
      )
    : null

export const readOfflineAuthGrant = (
  storage: GrantStorage = window.localStorage,
  now = Date.now(),
): OfflineAuthGrant | null => {
  try {
    const stored = storage.getItem(offlineAuthKey)
    if (stored === null) return null
    const grant = validGrant(JSON.parse(stored) as unknown, now)
    if (grant === null) storage.removeItem(offlineAuthKey)
    return grant
  } catch {
    return null
  }
}

export const persistOfflineAuthGrant = (
  status: AuthStatus,
  storage: GrantStorage = window.localStorage,
  now = Date.now(),
): OfflineAuthGrant | null => {
  const grant = offlineGrantFromAuthStatus(status, now)
  try {
    if (grant === null) storage.removeItem(offlineAuthKey)
    else storage.setItem(offlineAuthKey, JSON.stringify(grant))
  } catch {
    // Storage can be unavailable in private browsing; online auth still works.
  }
  return grant
}

export const clearOfflineAuthGrant = (storage: GrantStorage = window.localStorage): void => {
  try {
    storage.removeItem(offlineAuthKey)
  } catch {
    // Nothing else can be cleared when browser storage is unavailable.
  }
}

export const authStatusFromOfflineGrant = (grant: OfflineAuthGrant): AuthStatus => ({
  authenticated: true,
  authenticationRequired: true,
  displayName: grant.displayName,
  googleClientId: null,
  isAdmin: false,
  nameChoiceRequired: grant.nameChoiceRequired,
  sessionExpiresAt: grant.expiresAt,
})

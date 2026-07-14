import type { AuthStatus } from './auth-client.js'

const offlineAuthKey = 'little-tables-google-session-v1'

type GrantStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export type OfflineAuthGrant = Readonly<{
  displayName: string
  expiresAt: number
}>

const validGrant = (value: unknown, now: number): OfflineAuthGrant | null => {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (
    typeof record.displayName !== 'string' ||
    record.displayName.trim() === '' ||
    typeof record.expiresAt !== 'number' ||
    !Number.isFinite(record.expiresAt) ||
    record.expiresAt <= now
  ) {
    return null
  }
  return { displayName: record.displayName, expiresAt: record.expiresAt }
}

export const offlineGrantFromAuthStatus = (
  status: AuthStatus,
  now = Date.now(),
): OfflineAuthGrant | null =>
  status.authenticationRequired && status.authenticated
    ? validGrant({ displayName: status.displayName, expiresAt: status.sessionExpiresAt }, now)
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
  sessionExpiresAt: grant.expiresAt,
})

import { ChildProfileSchema, type ChildProfile } from '@little-tables/domain'
import { Either, Schema } from 'effect'

type ProfileStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

const activeProfileKey = 'little-tables-active-child-v1'
const cachedProfilesKey = 'little-tables-family-profiles-v1'
const CachedProfilesSchema = Schema.Array(ChildProfileSchema)

export const clearFamilyProfileDeviceState = (storage?: ProfileStorage): void => {
  const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage)
  if (target === null) return
  try {
    target.removeItem(activeProfileKey)
    target.removeItem(cachedProfilesKey)
  } catch {
    // No persistent family state is available to clear.
  }
}

export const readRememberedProfileId = (
  storage: ProfileStorage = window.localStorage,
): string | null => {
  try {
    const value = storage.getItem(activeProfileKey)?.trim()
    if (!value) return null
    return value
  } catch {
    return null
  }
}

export const rememberActiveProfile = (
  profileId: string,
  storage: ProfileStorage = window.localStorage,
): void => {
  try {
    storage.setItem(activeProfileKey, profileId)
  } catch {
    // The active profile remains available for this page lifetime.
  }
}

export const readCachedProfiles = (
  storage: ProfileStorage = window.localStorage,
): ReadonlyArray<ChildProfile> => {
  try {
    const stored = storage.getItem(cachedProfilesKey)
    if (stored === null) return []
    const decoded = Schema.decodeUnknownEither(CachedProfilesSchema)(JSON.parse(stored) as unknown)
    if (Either.isRight(decoded)) return decoded.right
    storage.removeItem(cachedProfilesKey)
    return []
  } catch {
    return []
  }
}

export const writeCachedProfiles = (
  profiles: ReadonlyArray<ChildProfile>,
  storage: ProfileStorage = window.localStorage,
): void => {
  try {
    storage.setItem(cachedProfilesKey, JSON.stringify(profiles))
  } catch {
    // The server remains authoritative when device storage is unavailable.
  }
}

export const resolveActiveProfileId = (
  profiles: ReadonlyArray<ChildProfile>,
  rememberedProfileId: string | null,
): string | null =>
  profiles.some(({ id }) => id === rememberedProfileId)
    ? rememberedProfileId
    : (profiles[0]?.id ?? null)

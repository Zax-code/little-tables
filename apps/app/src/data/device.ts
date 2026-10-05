/**
 * Small device settings kept in `localStorage` (`docs/rewrite/TECHNICAL_SPEC.md` §4.2). Every
 * value is decoded on read; a missing, unreadable or blocked storage falls back to defaults.
 */
import type { ChildProfile } from '@little-tables/api-contract'
import { Either, Schema } from 'effect'

import {
  AuthGrant,
  Preferences,
  ProfilesCache,
  defaultPreferences,
  type AuthGrant as Grant,
  type Preferences as DevicePreferences,
} from './schema.js'

export const keys = {
  activeProfile: 'little-tables:active-profile',
  authGrant: 'little-tables:auth-grant',
  preferences: 'little-tables:preferences',
  profilesCache: 'little-tables:profiles-cache',
  seenCards: 'little-tables:seen-cards',
} as const

/** Keys of the previous app, read by `adoptLegacyKeys` and `legacyProfileIds`. */
const legacyKeys = {
  activeProfile: 'little-tables-active-child-v1',
  authGrant: 'little-tables-google-session-v1',
  language: 'little-tables:locale',
  profilesCache: 'little-tables-family-profiles-v1',
  sound: 'little-tables:sound',
} as const

type Storage = Pick<globalThis.Storage, 'getItem' | 'removeItem' | 'setItem'>

const defaultStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const read = (key: string, storage: Storage | null): string | null => {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

const write = (key: string, value: string | null, storage: Storage | null) => {
  try {
    if (value === null) storage?.removeItem(key)
    else storage?.setItem(key, value)
  } catch {
    // Private browsing can refuse storage; the value stays valid for this page.
  }
}

const readJson = <A, I>(schema: Schema.Schema<A, I>, key: string, storage: Storage | null) => {
  const text = read(key, storage)
  if (text === null) return null
  try {
    const decoded = Schema.decodeUnknownEither(schema)(JSON.parse(text))
    return Either.isRight(decoded) ? decoded.right : null
  } catch {
    return null
  }
}

export const createDevice = (storage: Storage | null = defaultStorage()) => ({
  activeProfileId: () => read(keys.activeProfile, storage),
  setActiveProfileId: (profileId: string | null) => write(keys.activeProfile, profileId, storage),

  /** The grant when it is still valid at `now`. */
  authGrant: (now = Date.now()): Grant | null => {
    const grant = readJson(AuthGrant, keys.authGrant, storage)
    return grant !== null && grant.expiresAt > now ? grant : null
  },
  setAuthGrant: (grant: Grant | null) =>
    write(keys.authGrant, grant === null ? null : JSON.stringify(grant), storage),

  preferences: (): DevicePreferences =>
    readJson(Preferences, keys.preferences, storage) ?? defaultPreferences,
  setPreferences: (preferences: DevicePreferences) =>
    write(keys.preferences, JSON.stringify(preferences), storage),

  profiles: (): ReadonlyArray<ChildProfile> =>
    readJson(ProfilesCache, keys.profilesCache, storage) ?? [],
  setProfiles: (profiles: ReadonlyArray<ChildProfile>) =>
    write(keys.profilesCache, JSON.stringify(profiles), storage),

  seenCards: (): ReadonlyArray<string> =>
    readJson(Schema.Array(Schema.String), keys.seenCards, storage) ?? [],
  markCardSeen: (card: string) => {
    const seen = readJson(Schema.Array(Schema.String), keys.seenCards, storage) ?? []
    if (!seen.includes(card)) write(keys.seenCards, JSON.stringify([...seen, card]), storage)
  },

  /** Forgets everything tied to the signed-in family (sign-out). Preferences stay. */
  forgetFamily: () => {
    for (const key of [keys.activeProfile, keys.authGrant, keys.profilesCache, keys.seenCards]) {
      write(key, null, storage)
    }
  },

  /**
   * Takes over the previous app's settings: language and sound become preferences, the active
   * child and the offline grant keep the family signed in without network.
   */
  adoptLegacyKeys: (now = Date.now()) => {
    if (read(keys.preferences, storage) === null) {
      const language = read(legacyKeys.language, storage)
      write(
        keys.preferences,
        JSON.stringify({
          ...defaultPreferences,
          language: language === 'en' || language === 'zh-Hans' ? language : 'fr',
          sound: read(legacyKeys.sound, storage) !== 'off',
        }),
        storage,
      )
    }
    const activeProfile = read(legacyKeys.activeProfile, storage)?.trim()
    if (read(keys.activeProfile, storage) === null && activeProfile) {
      write(keys.activeProfile, activeProfile, storage)
    }
    const legacyGrant = readJson(
      Schema.Struct({
        expiresAt: Schema.Number,
        nameChoiceRequired: Schema.optional(Schema.Boolean),
      }),
      legacyKeys.authGrant,
      storage,
    )
    if (
      read(keys.authGrant, storage) === null &&
      legacyGrant !== null &&
      legacyGrant.expiresAt > now
    ) {
      write(
        keys.authGrant,
        JSON.stringify({
          email: null,
          expiresAt: Math.trunc(legacyGrant.expiresAt),
          isAdmin: false,
          onboardingRequired: legacyGrant.nameChoiceRequired ?? false,
        }),
        storage,
      )
    }
    // The previous keys are removed in lot 5, so that rolling back to the previous app stays safe.
  },

  /** Children the previous app knew on this device, whose old databases may need copying. */
  legacyProfileIds: (): ReadonlyArray<string> => {
    const profiles = readJson(
      Schema.Array(Schema.Struct({ id: Schema.NonEmptyString })),
      legacyKeys.profilesCache,
      storage,
    )
    return [...new Set(['lou', ...(profiles ?? []).map(({ id }) => id)])]
  },
})

export type Device = ReturnType<typeof createDevice>

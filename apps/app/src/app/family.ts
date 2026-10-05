/**
 * Who uses the app: the signed-in family and its children, online or from the device
 * (`docs/rewrite/TECHNICAL_SPEC.md` §4.4).
 */
import { ApiClient, type AuthStatus, type ChildProfile } from '@little-tables/api-contract'
import { Effect } from 'effect'

import type { Device } from '../data/device.js'
import { migrateLegacyDatabases } from '../data/migration.js'

export type Family = Readonly<{
  email: string | null
  isAdmin: boolean
  /** Opened from the device without reaching the server. */
  offline: boolean
  profiles: ReadonlyArray<ChildProfile>
}>

export type Access =
  | Readonly<{ kind: 'signed-out'; googleClientId: string | null }>
  | Readonly<{ kind: 'onboarding'; family: Family }>
  | Readonly<{ kind: 'ready'; family: Family }>
  /** No network and no valid grant: the first opening needs the Internet. */
  | Readonly<{ kind: 'offline' }>

const grantFrom = (status: AuthStatus) =>
  status.authenticationRequired && status.sessionExpiresAt !== null
    ? {
        email: status.email,
        expiresAt: status.sessionExpiresAt,
        isAdmin: status.isAdmin,
        onboardingRequired: status.onboardingRequired,
      }
    : null

/** Copies the previous app's data of these children, never blocking the opening. */
const migrate = (device: Device, profiles: ReadonlyArray<ChildProfile>) =>
  migrateLegacyDatabases(profiles.map(({ id }) => id)).pipe(
    Effect.tap(() => Effect.sync(() => device.markCardSeen('migrated'))),
    Effect.catchAll((failure) => Effect.logWarning('previous data could not be copied', failure)),
  )

/** Decides what the app opens on. */
export const openApp = (device: Device) =>
  Effect.gen(function* () {
    device.adoptLegacyKeys()
    const api = yield* ApiClient
    const status = yield* api.authStatus().pipe(Effect.either)
    if (status._tag === 'Left') {
      if (status.left._tag !== 'NetworkError') return yield* Effect.fail(status.left)
      const grant = device.authGrant()
      if (grant === null) return { kind: 'offline' } satisfies Access
      const family: Family = {
        email: grant.email,
        isAdmin: grant.isAdmin,
        offline: true,
        profiles: device.profiles(),
      }
      return grant.onboardingRequired
        ? ({ family, kind: 'onboarding' } satisfies Access)
        : ({ family, kind: 'ready' } satisfies Access)
    }
    if (!status.right.authenticated) {
      device.setAuthGrant(null)
      return { googleClientId: status.right.googleClientId, kind: 'signed-out' } satisfies Access
    }
    device.setAuthGrant(grantFrom(status.right))
    const { profiles } = yield* api.profiles()
    device.setProfiles(profiles)
    yield* migrate(device, profiles)
    const family: Family = {
      email: status.right.email,
      isAdmin: status.right.isAdmin,
      offline: false,
      profiles,
    }
    return status.right.onboardingRequired
      ? ({ family, kind: 'onboarding' } satisfies Access)
      : ({ family, kind: 'ready' } satisfies Access)
  })

/** The child to show: the remembered one when still in the family, else the first. */
export const activeProfileOf = (profiles: ReadonlyArray<ChildProfile>, remembered: string | null) =>
  profiles.find(({ id }) => id === remembered) ?? profiles[0] ?? null

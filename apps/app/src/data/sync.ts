/**
 * Synchronisation with the server (`docs/rewrite/TECHNICAL_SPEC.md` §4.3):
 * 1. send the outbox of every child, 100 events at a time;
 * 2. only when every outbox is empty, fetch the active child's state and merge it;
 * 3. renew the session.
 */
import { ApiClient, ApiError, type Bootstrap } from '@little-tables/api-contract'
import { Data, Effect } from 'effect'

import { LocalStore } from './local-store.js'
import { forgetLegacyDatabase } from './migration.js'
import type { ProfileState } from './schema.js'

/** The server no longer knows this device's session: back to the sign-in screen. */
export class SignedOut extends Data.TaggedError('SignedOut') {}

/** A child of this device no longer belongs to the signed-in family. */
export class ProfileGone extends Data.TaggedError('ProfileGone')<{ readonly profileId: string }> {}

const BATCH = 100
const MAX_BATCHES = 100

/** Keeps the highest bloom count and every rewarded day, as the engine's ledger merge does. */
export const mergeLedgers = (
  ledgers: ReadonlyArray<
    Readonly<{ gardenBloomCount: number; rewardedDayKeys: ReadonlyArray<string> }>
  >,
) => {
  const rewardedDayKeys = [...new Set(ledgers.flatMap((ledger) => ledger.rewardedDayKeys))].sort()
  const highest = Math.max(0, ...ledgers.map((ledger) => Math.floor(ledger.gardenBloomCount)))
  return { gardenBloomCount: Math.max(highest, rewardedDayKeys.length), rewardedDayKeys }
}

/**
 * The device state after the server's: the server's snapshot and collection win (every local
 * event has reached it), counts and days never go backwards, the session in progress stays.
 */
export const mergeServerState = (local: ProfileState, server: Bootstrap): ProfileState => {
  const ledger = mergeLedgers([local, server])
  return {
    ...local,
    completedSessions: Math.max(local.completedSessions, server.completedSessions),
    gardenBloomCount: ledger.gardenBloomCount,
    gardenCollection: {
      ...server.gardenCollection,
      introductionSeen:
        server.gardenCollection.introductionSeen || local.gardenCollection.introductionSeen,
    },
    practiceDayKeys: [...new Set([...local.practiceDayKeys, ...server.practiceDayKeys])].sort(),
    rewardedDayKeys: ledger.rewardedDayKeys,
    snapshot: server.snapshot,
  }
}

const classify =
  (profileId: string) =>
  (failure: ApiError): Effect.Effect<never, ApiError | ProfileGone | SignedOut> =>
    failure.status === 401
      ? Effect.fail(new SignedOut())
      : failure.status === 403 || failure.status === 404
        ? Effect.fail(new ProfileGone({ profileId }))
        : Effect.fail(failure)

/** Sends one child's outbox. Returns the number of events the server refused. */
export const flushOutbox = (profileId: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient
    const store = yield* LocalStore
    let rejected = 0
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const pending = yield* store.pending(profileId, BATCH)
      if (pending.length === 0) break
      const result = yield* api
        .sync(profileId, pending)
        .pipe(Effect.catchTag('ApiError', classify(profileId)))
      yield* store.acknowledge(
        profileId,
        [
          ...result.accepted,
          ...result.duplicates,
          ...result.rejected.map(({ eventId }) => eventId),
        ],
        result.rejected,
      )
      rejected += result.rejected.length
      if (pending.length < BATCH) break
    }
    yield* forgetLegacyDatabase(profileId)
    return rejected
  })

export type SyncOutcome = Readonly<{
  /** Children whose events could not be sent because they left the family. */
  gone: ReadonlyArray<string>
  merged: boolean
  sessionExpiresAt: number | null
}>

export const synchronize = (
  input: Readonly<{ activeProfileId: string; profileIds: ReadonlyArray<string> }>,
) =>
  Effect.gen(function* () {
    const api = yield* ApiClient
    const store = yield* LocalStore
    const gone: string[] = []
    for (const profileId of input.profileIds) {
      yield* flushOutbox(profileId).pipe(
        Effect.catchTag('ProfileGone', () => Effect.sync(() => void gone.push(profileId))),
      )
    }
    let pending = 0
    for (const profileId of input.profileIds) {
      if (!gone.includes(profileId)) pending += yield* store.pendingCount(profileId)
    }
    let merged = false
    if (pending === 0 && !gone.includes(input.activeProfileId)) {
      const server = yield* api
        .bootstrap(input.activeProfileId)
        .pipe(Effect.catchTag('ApiError', classify(input.activeProfileId)))
      const local = yield* store.load(input.activeProfileId)
      if (local.gardenCollection.introductionSeen && !server.gardenCollection.introductionSeen) {
        yield* api
          .introductionSeen(input.activeProfileId)
          .pipe(Effect.catchTag('ApiError', classify(input.activeProfileId)))
      }
      yield* store.update(input.activeProfileId, (current) => ({
        state: mergeServerState(current, server),
      }))
      merged = true
    }
    const refreshed = yield* api
      .refresh()
      .pipe(
        Effect.catchTag('ApiError', (failure): Effect.Effect<never, ApiError | SignedOut> =>
          failure.status === 401 ? Effect.fail(new SignedOut()) : Effect.fail(failure),
        ),
      )
    return { gone, merged, sessionExpiresAt: refreshed.sessionExpiresAt } satisfies SyncOutcome
  })

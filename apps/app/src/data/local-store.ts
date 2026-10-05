/**
 * One IndexedDB database per child, `little-tables-v3:{profileId}`
 * (`docs/rewrite/TECHNICAL_SPEC.md` §4.2). An answer writes its event, its outbox entry and the
 * new state in one transaction.
 */
import type { AttemptEvent } from '@little-tables/engine/schema'
import { AttemptEvent as AttemptEventSchema } from '@little-tables/engine/schema'
import Dexie, { type EntityTable } from 'dexie'
import { Context, Data, Effect, Layer, Schema } from 'effect'

import { gardenFlowerIds } from './garden-flowers.js'
import { ProfileState, SyncMeta, emptyMeta, type ProfileState as State } from './schema.js'

export class StoreError extends Data.TaggedError('StoreError')<{
  readonly cause: unknown
  readonly operation: string
}> {}

type OutboxRow = Readonly<{ createdAt: number; eventId: string }>
type StateRow = Readonly<{ id: 'current'; value: unknown }>
type MetaRow = Readonly<{ id: 'sync'; value: unknown }>

type ProfileDatabase = Dexie & {
  events: EntityTable<AttemptEvent, 'eventId'>
  meta: EntityTable<MetaRow, 'id'>
  outbox: EntityTable<OutboxRow, 'eventId'>
  state: EntityTable<StateRow, 'id'>
}

export const databaseName = (profileId: string) => `little-tables-v3:${profileId}`

const open = (profileId: string): ProfileDatabase => {
  const database = new Dexie(databaseName(profileId)) as ProfileDatabase
  database.version(1).stores({
    events: '&eventId, sessionId, [sessionId+sequence], answeredAt',
    meta: '&id',
    outbox: '&eventId, createdAt',
    state: '&id',
  })
  return database
}

export const emptyState = (): State => ({
  activeSession: null,
  completedSessions: 0,
  gardenBloomCount: 0,
  gardenCollection: {
    awardedFlowerIds: [],
    bloomsPerFlower: 3,
    catalogVersion: '1',
    flowerOrder: [...gardenFlowerIds],
    introductionSeen: false,
  },
  lastCompletion: null,
  practiceDayKeys: [],
  rewardedDayKeys: [],
  sessionStartSnapshot: null,
  snapshot: { algorithmVersion: '1', facts: {}, processedEventIds: [] },
})

const decodeState = Schema.decodeUnknownSync(ProfileState)
const decodeMeta = Schema.decodeUnknownSync(SyncMeta)
const decodeEvent = Schema.decodeUnknownSync(AttemptEventSchema)

const readState = async (database: ProfileDatabase): Promise<State> => {
  const row = await database.state.get('current')
  return row === undefined ? emptyState() : decodeState(row.value)
}

const readMeta = async (database: ProfileDatabase): Promise<SyncMeta> => {
  const row = await database.meta.get('sync')
  return row === undefined ? emptyMeta : decodeMeta(row.value)
}

/** What a change of state can also record, in the same transaction. */
export type Change = Readonly<{
  events?: ReadonlyArray<AttemptEvent>
  state: State
}>

const make = () => {
  const databases = new Map<string, ProfileDatabase>()
  const database = (profileId: string) => {
    const existing = databases.get(profileId)
    if (existing !== undefined) return existing
    const created = open(profileId)
    databases.set(profileId, created)
    return created
  }
  const attempt = <A>(operation: string, run: () => Promise<A>) =>
    Effect.tryPromise({ catch: (cause) => new StoreError({ cause, operation }), try: run })

  return {
    /** Every recorded event of a session, in answer order. */
    sessionEvents: (profileId: string, sessionId: string) =>
      attempt('session-events', async () =>
        (
          await database(profileId)
            .events.where('[sessionId+sequence]')
            .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
            .toArray()
        ).map((event) => decodeEvent(event)),
      ),

    load: (profileId: string) => attempt('load', () => readState(database(profileId))),

    meta: (profileId: string) => attempt('meta', () => readMeta(database(profileId))),

    /**
     * Applies `change` to the current state atomically. New events are recorded and queued for
     * the server; an event already recorded is left as it is.
     */
    update: (profileId: string, change: (current: State) => Change) =>
      attempt('update', async () => {
        const target = database(profileId)
        return target.transaction('rw', [target.events, target.outbox, target.state], async () => {
          const next = change(await readState(target))
          const state = decodeState(next.state)
          for (const event of next.events ?? []) {
            if ((await target.events.get(event.eventId)) !== undefined) continue
            await target.events.put(event)
            await target.outbox.put({ createdAt: Date.now(), eventId: event.eventId })
          }
          await target.state.put({ id: 'current', value: state })
          return state
        })
      }),

    /** The oldest unsent events, at most `limit`. */
    pending: (profileId: string, limit: number) =>
      attempt('pending', async () => {
        const target = database(profileId)
        const rows = await target.outbox.orderBy('createdAt').limit(limit).toArray()
        const events = await target.events.bulkGet(rows.map(({ eventId }) => eventId))
        return events.filter((event) => event !== undefined).map((event) => decodeEvent(event))
      }),

    pendingCount: (profileId: string) =>
      attempt('pending-count', () => database(profileId).outbox.count()),

    /** Removes answered events from the outbox and records the server's refusals. */
    acknowledge: (
      profileId: string,
      eventIds: ReadonlyArray<string>,
      rejections: ReadonlyArray<Readonly<{ eventId: string; reason: string }>>,
    ) =>
      attempt('acknowledge', async () => {
        const target = database(profileId)
        await target.transaction('rw', [target.outbox, target.meta], async () => {
          await target.outbox.bulkDelete([...eventIds])
          const meta = await readMeta(target)
          await target.meta.put({
            id: 'sync',
            value: {
              ...meta,
              lastRejections: [...rejections, ...meta.lastRejections].slice(0, 20),
              lastSyncedAt: Date.now(),
              rejectedCount: meta.rejectedCount + rejections.length,
            },
          })
        })
      }),

    setMeta: (profileId: string, change: (meta: SyncMeta) => SyncMeta) =>
      attempt('set-meta', async () => {
        const target = database(profileId)
        await target.transaction('rw', [target.meta], async () => {
          await target.meta.put({ id: 'sync', value: change(await readMeta(target)) })
        })
      }),

    /** Copies records of the previous app, keeping any already in this database. */
    importLegacy: (
      profileId: string,
      input: Readonly<{
        events: ReadonlyArray<AttemptEvent>
        legacyDatabase: string
        pending: ReadonlyArray<string>
        skippedEvents: number
        state: State | null
      }>,
    ) =>
      attempt('import-legacy', async () => {
        const target = database(profileId)
        await target.transaction(
          'rw',
          [target.events, target.outbox, target.state, target.meta],
          async () => {
            await target.events.bulkPut([...input.events])
            await target.outbox.bulkPut(
              input.pending.map((eventId, index) => ({ createdAt: index, eventId })),
            )
            if (input.state !== null && (await target.state.get('current')) === undefined) {
              await target.state.put({ id: 'current', value: decodeState(input.state) })
            }
            await target.meta.put({
              id: 'sync',
              value: {
                ...(await readMeta(target)),
                legacyDatabase: input.legacyDatabase,
                legacySkippedEvents: input.skippedEvents,
              },
            })
          },
        )
      }),

    /** Deletes a child's database, after their removal or at sign-out. */
    remove: (profileId: string) =>
      attempt('remove', async () => {
        databases.get(profileId)?.close()
        databases.delete(profileId)
        await Dexie.delete(databaseName(profileId))
      }),
  } as const
}

export type LocalStoreService = ReturnType<typeof make>

export class LocalStore extends Context.Tag('@little-tables/app/LocalStore')<
  LocalStore,
  LocalStoreService
>() {
  static readonly layer = Layer.sync(LocalStore, make)
}

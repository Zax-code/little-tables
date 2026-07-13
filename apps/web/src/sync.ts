import type { AttemptEvent } from '@little-tables/domain'
import { Schema } from 'effect'

type SyncStore = Readonly<{
  acknowledge: (attemptIds: ReadonlyArray<string>) => Promise<void>
  pendingBatch: (limit: number) => Promise<Readonly<{ attempts: ReadonlyArray<AttemptEvent> }>>
}>

const SyncResponseSchema = Schema.Struct({
  accepted: Schema.Array(Schema.String),
  duplicates: Schema.Array(Schema.String),
  rejected: Schema.Array(Schema.Struct({ eventId: Schema.String, reason: Schema.String })),
})

type FlushInput = Readonly<{
  fetcher?: typeof fetch
  profileId: string
  store: SyncStore
}>

export type SyncSummary = Readonly<{
  acknowledged: number
  rejected: number
  status: 'idle' | 'synced'
}>

export async function flushPendingAttempts({
  fetcher = fetch,
  profileId,
  store,
}: FlushInput): Promise<SyncSummary> {
  const batch = await store.pendingBatch(100)
  if (batch.attempts.length === 0) return { acknowledged: 0, rejected: 0, status: 'idle' }

  const response = await fetcher('/api/v1/attempts/sync', {
    body: JSON.stringify({ attempts: batch.attempts, profileId }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) throw new Error(`Sync failed with status ${response.status}`)
  const body = await Schema.decodeUnknownPromise(SyncResponseSchema)(await response.json())

  const acknowledged = [
    ...body.accepted,
    ...body.duplicates,
    ...body.rejected.map(({ eventId }) => eventId),
  ]
  await store.acknowledge(acknowledged)
  return {
    acknowledged: acknowledged.length,
    rejected: body.rejected.length,
    status: 'synced',
  }
}

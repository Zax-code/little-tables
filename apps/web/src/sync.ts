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

export class SyncAuthenticationError extends Error {
  override readonly name = 'SyncAuthenticationError'
}

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
  if (response.status === 401) throw new SyncAuthenticationError('Authentication is required')
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

export async function flushAllPendingAttempts(input: FlushInput): Promise<SyncSummary> {
  let acknowledged = 0
  let rejected = 0
  for (let batch = 0; batch < 100; batch += 1) {
    const result = await flushPendingAttempts(input)
    acknowledged += result.acknowledged
    rejected += result.rejected
    if (result.status === 'idle' || result.acknowledged < 100) {
      return { acknowledged, rejected, status: acknowledged === 0 ? 'idle' : 'synced' }
    }
  }
  throw new Error('Sync outbox exceeded the safe foreground batch limit')
}

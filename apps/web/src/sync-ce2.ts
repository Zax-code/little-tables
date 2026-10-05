import type { Ce2Attempt, Ce2PreferenceUpdate } from '@little-tables/domain'
import { Schema } from 'effect'

import { SyncAuthenticationError, type SyncSummary } from './sync.js'

type Ce2SyncStore = Readonly<{
  acknowledgeCe2: (eventIds: ReadonlyArray<string>) => Promise<void>
  pendingCe2Batch: (limit: number) => Promise<
    Readonly<{
      attempts: ReadonlyArray<Ce2Attempt>
      preferenceUpdates: ReadonlyArray<Ce2PreferenceUpdate>
    }>
  >
}>

const ResponseSchema = Schema.Struct({
  accepted: Schema.Array(Schema.String),
  duplicates: Schema.Array(Schema.String),
  rejected: Schema.Array(Schema.Struct({ eventId: Schema.String, reason: Schema.String })),
})

type FlushInput = Readonly<{
  fetcher?: typeof fetch
  profileId: string
  store: Ce2SyncStore
}>

export async function flushPendingCe2Attempts({
  fetcher = fetch,
  profileId,
  store,
}: FlushInput): Promise<SyncSummary> {
  const batch = await store.pendingCe2Batch(100)
  const submittedIds = new Set([
    ...batch.attempts.map(({ eventId }) => eventId),
    ...batch.preferenceUpdates.map(({ eventId }) => eventId),
  ])
  if (submittedIds.size === 0) return { acknowledged: 0, rejected: 0, status: 'idle' }

  const response = await fetcher('/api/v2/attempts/sync', {
    body: JSON.stringify({ ...batch, profileId }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (response.status === 401) throw new SyncAuthenticationError('Authentication is required')
  if (!response.ok) throw new Error(`CE2 sync failed with status ${response.status}`)
  const result = await Schema.decodeUnknownPromise(ResponseSchema)(await response.json())
  const acknowledged = [
    ...new Set([
      ...result.accepted,
      ...result.duplicates,
      ...result.rejected.map(({ eventId }) => eventId),
    ]),
  ].filter((eventId) => submittedIds.has(eventId))
  if (acknowledged.length === 0) throw new Error('CE2 sync did not acknowledge any submitted event')
  await store.acknowledgeCe2(acknowledged)
  return {
    acknowledged: acknowledged.length,
    rejected: result.rejected.filter(({ eventId }) => submittedIds.has(eventId)).length,
    status: 'synced',
  }
}

export async function flushAllPendingCe2Attempts(input: FlushInput): Promise<SyncSummary> {
  let acknowledged = 0
  let rejected = 0
  for (let batch = 0; batch < 100; batch += 1) {
    const result = await flushPendingCe2Attempts(input)
    acknowledged += result.acknowledged
    rejected += result.rejected
    if (result.status === 'idle') {
      return { acknowledged, rejected, status: acknowledged === 0 ? 'idle' : 'synced' }
    }
  }
  throw new Error('CE2 sync outbox exceeded the safe foreground batch limit')
}

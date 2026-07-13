import type { AttemptEvent } from '@little-tables/domain'

type SyncStore = Readonly<{
  acknowledge: (attemptIds: ReadonlyArray<string>) => Promise<void>
  pendingBatch: (limit: number) => Promise<Readonly<{ attempts: ReadonlyArray<AttemptEvent> }>>
}>

type SyncResponse = Readonly<{
  accepted: ReadonlyArray<string>
  duplicates: ReadonlyArray<string>
  rejected: ReadonlyArray<Readonly<{ eventId: string; reason: string }>>
}>

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

const isSyncResponse = (value: unknown): value is SyncResponse => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.accepted) &&
    Array.isArray(candidate.duplicates) &&
    Array.isArray(candidate.rejected)
  )
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
  if (!response.ok) throw new Error(`Sync failed with status ${response.status}`)
  const body: unknown = await response.json()
  if (!isSyncResponse(body)) throw new Error('Sync returned an invalid response')

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

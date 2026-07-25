import { IndexedDbPracticeStore } from '@little-tables/local-store'

const stores = new Map<string, IndexedDbPracticeStore>()

export const practiceDatabaseName = (profileId: string): string =>
  profileId === 'lou' ? 'little-tables-v1' : `little-tables-v2:${profileId}`

export const practiceStoreFor = (profileId: string): IndexedDbPracticeStore => {
  const existing = stores.get(profileId)
  if (existing !== undefined) return existing
  const store = new IndexedDbPracticeStore(practiceDatabaseName(profileId))
  stores.set(profileId, store)
  return store
}

export const localBootstrapQueryKey = (profileId: string) => ['local-bootstrap', profileId] as const

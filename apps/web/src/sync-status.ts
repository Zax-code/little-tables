export const syncStatusQueryKey = ['sync-status'] as const

export type SyncStatus = 'saved' | 'synced' | 'syncing'

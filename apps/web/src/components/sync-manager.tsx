import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { authStatusQueryKey } from '../auth-client.js'
import { scheduleInitialSync } from '../initial-sync.js'
import { practiceStore } from '../store.js'
import { SyncAuthenticationError, flushAllPendingAttempts } from '../sync.js'
import { syncStatusQueryKey, type SyncStatus } from '../sync-status.js'
import type { LearningSnapshot } from '@little-tables/domain'

export function SyncManager() {
  const queryClient = useQueryClient()
  const sync = useMutation({
    mutationFn: () => flushAllPendingAttempts({ profileId: 'lou', store: practiceStore }),
    onError: (error) => {
      queryClient.setQueryData<SyncStatus>(syncStatusQueryKey, 'saved')
      if (error instanceof SyncAuthenticationError) {
        void queryClient.invalidateQueries({ queryKey: authStatusQueryKey })
      }
    },
    onMutate: () => queryClient.setQueryData<SyncStatus>(syncStatusQueryKey, 'syncing'),
    onSuccess: () => queryClient.setQueryData<SyncStatus>(syncStatusQueryKey, 'synced'),
  })
  const { mutate } = sync

  useEffect(() => {
    const flush = () => {
      if (!navigator.onLine) return
      mutate(undefined, {
        onSuccess: () => {
          void (async () => {
            const response = await fetch('/api/v1/bootstrap')
            if (response.status === 401) {
              await queryClient.invalidateQueries({ queryKey: authStatusQueryKey })
              return
            }
            if (!response.ok) return
            const body: unknown = await response.json()
            if (typeof body !== 'object' || body === null || !('snapshot' in body)) return
            const server = body as {
              completedSessions?: number
              practiceDayKeys?: ReadonlyArray<string>
              snapshot: LearningSnapshot
            }
            const snapshot = server.snapshot
            const facts = Object.fromEntries(
              Object.entries(snapshot.facts).map(([key, fact]) => [
                key,
                {
                  ...fact,
                  dueAt: fact.dueAt === null ? null : new Date(fact.dueAt),
                  lastReviewedAt:
                    fact.lastReviewedAt === null ? null : new Date(fact.lastReviewedAt),
                },
              ]),
            )
            await practiceStore.replaceSnapshot(
              { ...snapshot, facts },
              {
                completedSessions: server.completedSessions ?? 0,
                practiceDayKeys: server.practiceDayKeys ?? [],
              },
            )
            const refresh = await fetch('/api/v1/session/refresh', { method: 'POST' })
            if (refresh.status === 401) {
              await queryClient.invalidateQueries({ queryKey: authStatusQueryKey })
              return
            }
            if (refresh.ok) {
              await queryClient.invalidateQueries({ queryKey: authStatusQueryKey })
            }
            await queryClient.invalidateQueries({ queryKey: ['local-bootstrap'] })
          })().catch(() => queryClient.setQueryData<SyncStatus>(syncStatusQueryKey, 'saved'))
        },
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') flush()
    }
    const cancelInitialFlush = scheduleInitialSync(flush)
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelInitialFlush()
      window.removeEventListener('online', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [mutate, queryClient])

  return null
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { authStatusQueryKey } from '../auth-client.js'
import { scheduleInitialSync } from '../initial-sync.js'
import { localBootstrapQueryKey, practiceStoreFor } from '../store.js'
import { SyncAuthenticationError, flushAllPendingAttempts } from '../sync.js'
import { syncStatusQueryKey, type SyncStatus } from '../sync-status.js'
import { decodeServerBootstrap } from '../bootstrap-client.js'
import { useFamilyProfile } from '../use-family-profile.js'

export function SyncManager() {
  const queryClient = useQueryClient()
  const { activeProfile } = useFamilyProfile()
  const practiceStore = practiceStoreFor(activeProfile.id)
  const sync = useMutation({
    mutationFn: () =>
      flushAllPendingAttempts({ profileId: activeProfile.id, store: practiceStore }),
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
            const [local, response] = await Promise.all([
              practiceStore.load(),
              fetch('/api/v1/bootstrap', {
                headers: { 'x-little-tables-profile-id': activeProfile.id },
              }),
            ])
            if (response.status === 401) {
              await queryClient.invalidateQueries({ queryKey: authStatusQueryKey })
              return
            }
            if (!response.ok) return
            let server = await decodeServerBootstrap(await response.json())
            if (
              local.gardenCollection.introductionSeen &&
              !server.gardenCollection.introductionSeen
            ) {
              const introductionResponse = await fetch('/api/v1/garden/introduction-seen', {
                headers: { 'x-little-tables-profile-id': activeProfile.id },
                method: 'POST',
              })
              if (introductionResponse.ok) {
                server = {
                  ...server,
                  gardenCollection: {
                    ...server.gardenCollection,
                    introductionSeen: true,
                  },
                }
              }
            }
            await practiceStore.replaceSnapshot(server.snapshot, {
              completedSessions: server.completedSessions,
              gardenBloomCount: server.gardenBloomCount,
              gardenCollection: server.gardenCollection,
              practiceDayKeys: server.practiceDayKeys,
              rewardedDayKeys: server.rewardedDayKeys,
            })
            const refresh = await fetch('/api/v1/session/refresh', { method: 'POST' })
            if (refresh.status === 401) {
              await queryClient.invalidateQueries({ queryKey: authStatusQueryKey })
              return
            }
            if (refresh.ok) {
              await queryClient.invalidateQueries({ queryKey: authStatusQueryKey })
            }
            await queryClient.invalidateQueries({
              queryKey: localBootstrapQueryKey(activeProfile.id),
            })
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
  }, [activeProfile.id, mutate, practiceStore, queryClient])

  return null
}

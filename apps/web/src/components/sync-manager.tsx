import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { practiceStore } from '../store.js'
import { flushPendingAttempts } from '../sync.js'

export const syncStatusQueryKey = ['sync-status'] as const

export function SyncManager() {
  const queryClient = useQueryClient()
  const sync = useMutation({
    mutationFn: () => flushPendingAttempts({ profileId: 'lou', store: practiceStore }),
    onError: () => queryClient.setQueryData(syncStatusQueryKey, 'saved on this phone'),
    onMutate: () => queryClient.setQueryData(syncStatusQueryKey, 'syncing'),
    onSuccess: () => queryClient.setQueryData(syncStatusQueryKey, 'synced'),
  })
  const { mutate } = sync

  useEffect(() => {
    const claimInvite = async () => {
      const url = new URL(window.location.href)
      const invite = url.searchParams.get('invite')
      if (invite === null) return
      const response = await fetch('/api/v1/invites/claim', {
        body: JSON.stringify({ token: invite }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok) throw new Error('The private invite could not be claimed.')
      url.searchParams.delete('invite')
      window.history.replaceState(null, '', url)
    }
    const flush = () => {
      if (navigator.onLine) mutate()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') flush()
    }
    void claimInvite()
      .then(flush)
      .catch(() => {
        queryClient.setQueryData(syncStatusQueryKey, 'invite needed')
      })
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('online', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [mutate, queryClient])

  return null
}

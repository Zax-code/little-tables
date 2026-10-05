/** The active child's state on this device, cached with React Query. */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { useCallback } from 'react'

import { LocalStore } from '../data/local-store.js'
import type { ProfileState } from '../data/schema.js'
import { useApp } from './app-context.js'

export const profileStateKey = (profileId: string) => ['profile-state', profileId] as const

/** The active child's state on this device. */
export function useProfileState() {
  const { activeProfile, runtime } = useApp()
  return useQuery({
    queryFn: () =>
      runtime.runPromise(Effect.flatMap(LocalStore, (store) => store.load(activeProfile.id))),
    queryKey: profileStateKey(activeProfile.id),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** Stores a new state in the cache after a local change. */
export function useSetProfileState() {
  const queryClient = useQueryClient()
  const { activeProfile } = useApp()
  return useCallback(
    (state: ProfileState) => queryClient.setQueryData(profileStateKey(activeProfile.id), state),
    [activeProfile.id, queryClient],
  )
}

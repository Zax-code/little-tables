import { FamilyProfiles, type ChildProfile } from '@little-tables/domain'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEffect, useMemo, useState } from 'react'

import type { AuthStatus } from './auth-client.js'
import { authStatusQueryKey } from './auth-client.js'
import { familyProfilesQueryKey, fetchFamilyProfiles } from './family-profile-client.js'
import {
  readCachedProfiles,
  readRememberedProfileId,
  rememberActiveProfile,
  resolveActiveProfileId,
  writeCachedProfiles,
} from './family-profile-device.js'
import { FamilyProfileContext, type FamilyProfileContextValue } from './family-profile-context.js'

export function FamilyProfileProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const cachedProfiles = useMemo(() => readCachedProfiles(), [])
  const [activeProfileId, setActiveProfileId] = useState(() =>
    resolveActiveProfileId(cachedProfiles, readRememberedProfileId()),
  )
  const family = useQuery({
    initialData: cachedProfiles.length === 0 ? undefined : cachedProfiles,
    initialDataUpdatedAt: 0,
    queryFn: () => fetchFamilyProfiles(),
    queryKey: familyProfilesQueryKey,
    retry: 1,
    staleTime: 30_000,
  })
  const auth = queryClient.getQueryData<AuthStatus>(authStatusQueryKey)
  const fallbackProfile = useMemo<ChildProfile | null>(
    () =>
      typeof auth?.profileId === 'string'
        ? {
            avatarId: FamilyProfiles.defaultAvatarId,
            id: auth.profileId,
            name: auth.displayName ?? 'learner',
          }
        : null,
    [auth],
  )
  const profiles = useMemo<ReadonlyArray<ChildProfile>>(
    () =>
      family.data && family.data.length > 0
        ? family.data
        : family.isError && fallbackProfile !== null
          ? [fallbackProfile]
          : [],
    [fallbackProfile, family.data, family.isError],
  )

  useEffect(() => {
    if (profiles.length === 0) return
    if (family.data !== undefined) writeCachedProfiles(family.data)
    const resolved = resolveActiveProfileId(profiles, activeProfileId)
    if (resolved === null) return
    rememberActiveProfile(resolved)
  }, [activeProfileId, family.data, profiles])

  const resolvedActiveProfileId = resolveActiveProfileId(profiles, activeProfileId)
  const activeProfile =
    profiles.find(({ id }) => id === resolvedActiveProfileId) ?? profiles[0] ?? null
  const value = useMemo<FamilyProfileContextValue | null>(
    () =>
      activeProfile === null
        ? null
        : {
            activeProfile,
            profiles,
            switchProfile: (profileId) => {
              if (!profiles.some(({ id }) => id === profileId)) return
              rememberActiveProfile(profileId)
              setActiveProfileId(profileId)
            },
          },
    [activeProfile, profiles],
  )

  if (value === null) return <div className="app-loading">opening your family…</div>
  return <FamilyProfileContext value={value}>{children}</FamilyProfileContext>
}

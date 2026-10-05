import type { ChildProfile } from '@little-tables/api-contract'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { Device } from '../data/device.js'
import { LocalStore } from '../data/local-store.js'
import type { Preferences, ProfileState } from '../data/schema.js'
import type { AppRuntime } from '../runtime.js'
import { activeProfileOf, type Family } from './family.js'

export type AppContextValue = Readonly<{
  activeProfile: ChildProfile
  device: Device
  family: Family
  preferences: Preferences
  runtime: AppRuntime
  selectProfile: (profileId: string) => void
  setPreferences: (preferences: Preferences) => void
  /** Replaces the family's children after a change in the parent space or a sync. */
  setProfiles: (profiles: ReadonlyArray<ChildProfile>) => void
  /** Asks the app to open again from the start (after sign-out or a lost session). */
  reopen: () => void
}>

const AppContext = createContext<AppContextValue | null>(null)

export const useApp = (): AppContextValue => {
  const value = use(AppContext)
  if (value === null) throw new Error('useApp is used outside the signed-in app')
  return value
}

/** Applies appearance and text size to the document, as chosen in the parent space. */
export function usePreferenceEffects(preferences: Preferences) {
  useEffect(() => {
    const root = document.documentElement
    root.lang = preferences.language
    if (preferences.appearance === 'system') delete root.dataset.theme
    else root.dataset.theme = preferences.appearance
    root.style.setProperty(
      '--lt-text-scale',
      preferences.textSize === 'larger' ? '1.25' : preferences.textSize === 'large' ? '1.12' : '1',
    )
  }, [preferences])
}

type ProviderProps = Readonly<{
  children: ReactNode
  device: Device
  family: Family
  preferences: Preferences
  reopen: () => void
  runtime: AppRuntime
  setPreferences: (preferences: Preferences) => void
}>

export function AppProvider({
  children,
  device,
  family,
  preferences,
  reopen,
  runtime,
  setPreferences,
}: ProviderProps) {
  const [profiles, setProfilesState] = useState(family.profiles)
  const [activeId, setActiveId] = useState(() => device.activeProfileId())
  const activeProfile = activeProfileOf(profiles, activeId)

  const selectProfile = useCallback(
    (profileId: string) => {
      device.setActiveProfileId(profileId)
      setActiveId(profileId)
    },
    [device],
  )
  const setProfiles = useCallback(
    (next: ReadonlyArray<ChildProfile>) => {
      device.setProfiles(next)
      setProfilesState(next)
    },
    [device],
  )

  const value = useMemo(
    () =>
      activeProfile === null
        ? null
        : {
            activeProfile,
            device,
            family: { ...family, profiles },
            preferences,
            reopen,
            runtime,
            selectProfile,
            setPreferences,
            setProfiles,
          },
    [
      activeProfile,
      device,
      family,
      preferences,
      profiles,
      reopen,
      runtime,
      selectProfile,
      setPreferences,
      setProfiles,
    ],
  )
  if (value === null) return null
  return <AppContext value={value}>{children}</AppContext>
}

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

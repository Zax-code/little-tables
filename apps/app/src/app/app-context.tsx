import type { ChildProfile } from '@little-tables/api-contract'
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'

import type { Device } from '../data/device.js'
import type { Preferences } from '../data/schema.js'
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
  const [profiles, setProfilesState] = useState(() => family.profiles)
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

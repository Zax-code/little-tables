import type { ChildProfile } from '@little-tables/domain'
import { createContext } from 'react'

export type FamilyProfileContextValue = Readonly<{
  activeProfile: ChildProfile
  profiles: ReadonlyArray<ChildProfile>
  switchProfile: (profileId: string) => void
}>

export const FamilyProfileContext = createContext<FamilyProfileContextValue | null>(null)

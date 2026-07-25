import { use } from 'react'

import { FamilyProfileContext } from './family-profile-context.js'

export function useFamilyProfile() {
  const value = use(FamilyProfileContext)
  if (value === null) throw new Error('FamilyProfileProvider is missing')
  return value
}

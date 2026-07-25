import type { PropsWithChildren } from 'react'
import { useMemo } from 'react'

import { resolveCharacter } from './character-catalog.js'
import { SelectedCharacterContext } from './selected-character-context.js'
import { useFamilyProfile } from './use-family-profile.js'

export function SelectedCharacterProvider({ children }: PropsWithChildren) {
  const { activeProfile } = useFamilyProfile()
  const character = useMemo(
    () => resolveCharacter(activeProfile.avatarId),
    [activeProfile.avatarId],
  )

  return <SelectedCharacterContext value={character}>{children}</SelectedCharacterContext>
}

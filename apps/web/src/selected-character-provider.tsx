import type { PropsWithChildren } from 'react'
import { useEffect, useMemo } from 'react'

import { resolveCharacter } from './character-catalog.js'
import { preloadImageSources } from './preload-images.js'
import { SelectedCharacterContext } from './selected-character-context.js'
import { useFamilyProfile } from './use-family-profile.js'

export function SelectedCharacterProvider({ children }: PropsWithChildren) {
  const { activeProfile } = useFamilyProfile()
  const character = useMemo(
    () => resolveCharacter(activeProfile.avatarId),
    [activeProfile.avatarId],
  )
  const connectProfileSource = character.scenes.connectProfile.src
  const homeSource = character.scenes.home.src

  useEffect(() => {
    void preloadImageSources([homeSource, connectProfileSource])
  }, [connectProfileSource, homeSource])

  return <SelectedCharacterContext value={character}>{children}</SelectedCharacterContext>
}

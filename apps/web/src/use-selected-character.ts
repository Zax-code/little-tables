import type { CharacterId } from '@little-tables/domain'
import { useContext, useMemo } from 'react'

import type {
  CharacterAsset,
  CharacterCatalogEntry,
  CharacterSceneId,
} from './character-catalog.js'
import { SelectedCharacterContext } from './selected-character-context.js'
import { useI18n } from './i18n.js'

export type SelectedCharacter = Readonly<
  CharacterCatalogEntry & {
    displayName: string
    id: CharacterId
    scene: (sceneId: CharacterSceneId) => CharacterAsset
  }
>

export function useSelectedCharacter(): SelectedCharacter {
  const character = useContext(SelectedCharacterContext)
  const { t } = useI18n()
  if (character === null) throw new Error('SelectedCharacterProvider is missing')

  return useMemo(
    () => ({
      ...character,
      displayName: t(character.displayNameKey),
      scene: (sceneId: CharacterSceneId) => character.scenes[sceneId],
    }),
    [character, t],
  )
}

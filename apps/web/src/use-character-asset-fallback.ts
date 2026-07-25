import { useState } from 'react'

import {
  safeMiffyCharacter,
  type CharacterAsset,
  type CharacterSceneId,
} from './character-catalog.js'
import { useI18n } from './i18n.js'
import { useSelectedCharacter } from './use-selected-character.js'

type AssetStage = 'error' | 'fallback' | 'fallback-error' | 'retry' | 'selected'

type AssetState = Readonly<{
  characterId: string
  revision: number
  sceneId: CharacterSceneId
  stage: AssetStage
}>

export type CharacterAssetFallback = Readonly<{
  asset: CharacterAsset
  assetCharacterId: string
  characterName: string
  key: string
  onError: () => void
  retry: () => void
  selectedCharacterId: string
  showRetry: boolean
  usingFallback: boolean
}>

export function useCharacterAssetFallback(sceneId: CharacterSceneId): CharacterAssetFallback {
  const selected = useSelectedCharacter()
  const { t } = useI18n()
  const [state, setState] = useState<AssetState>({
    characterId: selected.id,
    revision: 0,
    sceneId,
    stage: 'selected',
  })
  const belongsToSelection = state.characterId === selected.id && state.sceneId === sceneId
  const stage = belongsToSelection ? state.stage : 'selected'
  const usingFallback = stage === 'fallback' || stage === 'fallback-error'
  const asset = usingFallback ? safeMiffyCharacter.scenes[sceneId] : selected.scene(sceneId)
  const assetCharacterId = usingFallback ? safeMiffyCharacter.id : selected.id
  const characterName = usingFallback ? t(safeMiffyCharacter.displayNameKey) : selected.displayName
  const revision = belongsToSelection ? state.revision : 0

  const update = (nextStage: AssetStage, incrementRevision = false) => {
    setState({
      characterId: selected.id,
      revision: incrementRevision ? revision + 1 : revision,
      sceneId,
      stage: nextStage,
    })
  }

  return {
    asset,
    assetCharacterId,
    characterName,
    key: `${selected.id}:${sceneId}:${stage}:${revision}`,
    onError: () => {
      if (stage === 'selected') {
        update('error')
      } else if (stage === 'retry') {
        update('fallback')
      } else if (stage === 'fallback') {
        update('fallback-error')
      }
    },
    retry: () => {
      update(stage === 'fallback-error' ? 'fallback' : 'retry', true)
    },
    selectedCharacterId: selected.id,
    showRetry: stage === 'error' || stage === 'fallback-error',
    usingFallback,
  }
}

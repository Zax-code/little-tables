import {
  Characters,
  type CharacterId,
  type ChildAvatarId,
  type SelectableChildAvatarId,
} from '@little-tables/domain'

import type { TranslationKey } from './i18n.js'

export const characterSceneIds = [
  'connectProfile',
  'home',
  'practiceIdle',
  'practiceCorrect',
  'practiceEncourage',
  'updateRecovery',
  'celebration',
  'gardenWalk',
  'gardenWater',
] as const
export type CharacterSceneId = (typeof characterSceneIds)[number]

type PixelBounds = readonly [left: number, top: number, right: number, bottom: number]

export type CharacterAsset = Readonly<{
  altKey: TranslationKey
  fileName: string
  height: number
  opticalBounds?: PixelBounds
  source: 'gpt-image-built-in'
  src: string
  width: number
}>

export type CharacterCatalogEntry = Readonly<{
  avatar: Readonly<{ height: number; src: string; width: number }>
  displayNameKey: TranslationKey
  gardenGeometry: Readonly<{
    caretakerOffsetX: number
    caretakerOffsetY: number
    pourPointOffsetX: number
    pourPointOffsetY: number
  }>
  id: CharacterId
  scenes: Readonly<Record<CharacterSceneId, CharacterAsset>>
}>

const sceneDefinitions = {
  celebration: {
    altKey: 'asset.celebration',
    fileName: 'celebration-sheet.webp',
    height: 418,
    width: 1672,
  },
  connectProfile: {
    altKey: 'asset.google',
    fileName: 'connect-profile.webp',
    height: 256,
    width: 256,
  },
  gardenWalk: {
    altKey: 'asset.walking',
    fileName: 'garden-walk-sheet.webp',
    height: 1254,
    width: 1254,
  },
  gardenWater: {
    altKey: 'asset.watering',
    fileName: 'garden-water-sheet.webp',
    height: 1254,
    width: 1254,
  },
  home: {
    altKey: 'asset.home',
    fileName: 'home.webp',
    height: 494,
    width: 320,
  },
  practiceCorrect: {
    altKey: 'asset.practiceCorrect',
    fileName: 'practice-correct.webp',
    height: 922,
    width: 669,
  },
  practiceEncourage: {
    altKey: 'asset.practiceEncourage',
    fileName: 'practice-encourage.webp',
    height: 931,
    width: 785,
  },
  practiceIdle: {
    altKey: 'asset.practice',
    fileName: 'practice-idle.webp',
    height: 377,
    width: 327,
  },
  updateRecovery: {
    altKey: 'asset.updateRecovery',
    fileName: 'update-recovery.webp',
    height: 1210,
    width: 1005,
  },
} as const satisfies Readonly<
  Record<
    CharacterSceneId,
    Readonly<{
      altKey: TranslationKey
      fileName: string
      height: number
      width: number
    }>
  >
>

const displayNameKeys = {
  'colin-mallard': 'family.avatar.colin-mallard',
  'fenna-fox': 'family.avatar.fenna-fox',
  'malo-bear': 'family.avatar.malo-bear',
  miffy: 'family.avatar.sprout',
  'mina-cat': 'family.avatar.mina-cat',
  'paco-dog': 'family.avatar.paco-dog',
} as const satisfies Readonly<Record<CharacterId, TranslationKey>>

const avatarIds = {
  'colin-mallard': 'colin-mallard',
  'fenna-fox': 'fenna-fox',
  'malo-bear': 'malo-bear',
  miffy: 'miffy',
  'mina-cat': 'mina-cat',
  'paco-dog': 'paco-dog',
} as const satisfies Readonly<
  Record<CharacterId, SelectableChildAvatarId | 'miffy'>
>

function createCharacter(id: CharacterId): CharacterCatalogEntry {
  return {
    avatar: {
      height: 1254,
      src: `/avatars/${avatarIds[id]}.png`,
      width: 1254,
    },
    displayNameKey: displayNameKeys[id],
    gardenGeometry: {
      caretakerOffsetX: 0,
      caretakerOffsetY: 0,
      pourPointOffsetX: 0,
      pourPointOffsetY: 0,
    },
    id,
    scenes: Object.fromEntries(
      characterSceneIds.map((sceneId) => {
        const definition = sceneDefinitions[sceneId]
        return [
          sceneId,
          {
            ...definition,
            source: 'gpt-image-built-in',
            src: `/characters/${id}/${definition.fileName}`,
          },
        ]
      }),
    ) as Readonly<Record<CharacterSceneId, CharacterAsset>>,
  }
}

export const characterCatalog = {
  miffy: createCharacter('miffy'),
  'malo-bear': createCharacter('malo-bear'),
  'fenna-fox': createCharacter('fenna-fox'),
  'mina-cat': createCharacter('mina-cat'),
  'paco-dog': createCharacter('paco-dog'),
  'colin-mallard': createCharacter('colin-mallard'),
} as const satisfies Readonly<Record<CharacterId, CharacterCatalogEntry>>

export const safeMiffyCharacter = characterCatalog[Characters.defaultCharacterId]

export function resolveCharacter(avatarId: ChildAvatarId): CharacterCatalogEntry {
  return characterCatalog[Characters.resolveAvatarId(avatarId)]
}

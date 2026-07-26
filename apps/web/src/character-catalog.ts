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

export type PixelBounds = readonly [left: number, top: number, right: number, bottom: number]

export type CharacterAsset = Readonly<{
  altKey: TranslationKey
  fileName: string
  height: number
  opticalBounds: PixelBounds
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
} as const satisfies Readonly<Record<CharacterId, SelectableChildAvatarId | 'miffy'>>

const sceneOpticalBounds = {
  miffy: {
    connectProfile: [37, 4, 219, 252],
    home: [28, 28, 292, 466],
    practiceIdle: [28, 28, 299, 349],
    practiceCorrect: [18, 18, 651, 904],
    practiceEncourage: [18, 18, 767, 913],
    updateRecovery: [48, 48, 957, 1162],
    celebration: [103, 42, 1569, 376],
    gardenWalk: [232, 78, 1060, 1149],
    gardenWater: [183, 28, 1125, 1213],
  },
  'malo-bear': {
    connectProfile: [28, 33, 228, 216],
    home: [35, 52, 291, 425],
    practiceIdle: [31, 89, 295, 349],
    practiceCorrect: [26, 133, 634, 904],
    practiceEncourage: [30, 141, 755, 913],
    updateRecovery: [62, 247, 956, 1162],
    celebration: [96, 35, 1576, 376],
    gardenWalk: [185, 100, 1060, 1149],
    gardenWater: [135, 57, 1135, 1215],
  },
  'fenna-fox': {
    connectProfile: [37, 29, 220, 217],
    home: [29, 48, 297, 432],
    practiceIdle: [30, 57, 299, 349],
    practiceCorrect: [26, 101, 642, 904],
    practiceEncourage: [25, 77, 761, 913],
    updateRecovery: [58, 213, 956, 1162],
    celebration: [97, 44, 1577, 376],
    gardenWalk: [110, 111, 1060, 1149],
    gardenWater: [129, 76, 1133, 1215],
  },
  'mina-cat': {
    connectProfile: [24, 31, 232, 223],
    home: [48, 50, 279, 416],
    practiceIdle: [35, 79, 291, 349],
    practiceCorrect: [38, 180, 634, 904],
    practiceEncourage: [25, 107, 745, 913],
    updateRecovery: [92, 194, 955, 1162],
    celebration: [96, 38, 1577, 376],
    gardenWalk: [122, 122, 1060, 1149],
    gardenWater: [159, 96, 1130, 1220],
  },
  'paco-dog': {
    connectProfile: [23, 40, 233, 203],
    home: [29, 74, 291, 415],
    practiceIdle: [22, 94, 303, 349],
    practiceCorrect: [21, 200, 647, 904],
    practiceEncourage: [25, 197, 757, 913],
    updateRecovery: [64, 318, 963, 1162],
    celebration: [96, 76, 1576, 376],
    gardenWalk: [192, 165, 1060, 1149],
    gardenWater: [152, 131, 1131, 1224],
  },
  'colin-mallard': {
    connectProfile: [42, 24, 214, 207],
    home: [38, 42, 291, 431],
    practiceIdle: [26, 49, 300, 349],
    practiceCorrect: [44, 138, 630, 904],
    practiceEncourage: [28, 55, 759, 913],
    updateRecovery: [70, 206, 948, 1162],
    celebration: [95, 39, 1576, 375],
    gardenWalk: [158, 91, 1060, 1148],
    gardenWater: [153, 76, 1130, 1212],
  },
} as const satisfies Readonly<Record<CharacterId, Readonly<Record<CharacterSceneId, PixelBounds>>>>

function createSceneAsset(id: CharacterId, sceneId: CharacterSceneId): CharacterAsset {
  const definition = sceneDefinitions[sceneId]
  return {
    ...definition,
    opticalBounds: sceneOpticalBounds[id][sceneId],
    source: 'gpt-image-built-in',
    src: `/characters/${id}/${definition.fileName}`,
  }
}

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
    scenes: {
      connectProfile: createSceneAsset(id, 'connectProfile'),
      home: createSceneAsset(id, 'home'),
      practiceIdle: createSceneAsset(id, 'practiceIdle'),
      practiceCorrect: createSceneAsset(id, 'practiceCorrect'),
      practiceEncourage: createSceneAsset(id, 'practiceEncourage'),
      updateRecovery: createSceneAsset(id, 'updateRecovery'),
      celebration: createSceneAsset(id, 'celebration'),
      gardenWalk: createSceneAsset(id, 'gardenWalk'),
      gardenWater: createSceneAsset(id, 'gardenWater'),
    } satisfies Readonly<Record<CharacterSceneId, CharacterAsset>>,
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

const routeScenes = {
  celebration: ['celebration'],
  garden: ['gardenWalk', 'gardenWater'],
  home: ['home', 'connectProfile'],
  practice: ['practiceIdle', 'practiceCorrect', 'practiceEncourage'],
} as const satisfies Readonly<Record<string, readonly CharacterSceneId[]>>

export function characterSourcesForPath(
  character: CharacterCatalogEntry,
  pathname: string,
): readonly string[] {
  const scenes = pathname.startsWith('/practice')
    ? routeScenes.practice
    : pathname.startsWith('/celebration')
      ? routeScenes.celebration
      : pathname.startsWith('/garden')
        ? routeScenes.garden
        : routeScenes.home

  return scenes.map((sceneId) => character.scenes[sceneId].src)
}

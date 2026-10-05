/**
 * The six characters a child can pick, and their illustrated scenes
 * (`docs/rewrite/TECHNICAL_SPEC.md` §6.5). Avatars of older profiles map to Miffy.
 */
import type { AvatarId, SelectableAvatarId } from '@little-tables/api-contract'

export const characterIds = [
  'miffy',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
] as const
export type CharacterId = (typeof characterIds)[number]

export type SceneId =
  | 'celebration'
  | 'connectProfile'
  | 'gardenWalk'
  | 'gardenWater'
  | 'home'
  | 'practiceCorrect'
  | 'practiceEncourage'
  | 'practiceIdle'
  | 'updateRecovery'

export type Scene = Readonly<{ height: number; src: string; width: number }>

const scenes: Readonly<Record<SceneId, Readonly<{ file: string; height: number; width: number }>>> =
  {
    celebration: { file: 'celebration-sheet.webp', height: 418, width: 1672 },
    connectProfile: { file: 'connect-profile.webp', height: 256, width: 256 },
    gardenWalk: { file: 'garden-walk-sheet.webp', height: 1254, width: 1254 },
    gardenWater: { file: 'garden-water-sheet.webp', height: 1254, width: 1254 },
    home: { file: 'home.webp', height: 494, width: 320 },
    practiceCorrect: { file: 'practice-correct.webp', height: 922, width: 669 },
    practiceEncourage: { file: 'practice-encourage.webp', height: 931, width: 785 },
    practiceIdle: { file: 'practice-idle.webp', height: 377, width: 327 },
    updateRecovery: { file: 'update-recovery.webp', height: 1210, width: 1005 },
  }

const avatarCharacters: Readonly<Record<AvatarId, CharacterId>> = {
  berry: 'miffy',
  bluebell: 'miffy',
  'colin-mallard': 'colin-mallard',
  'fenna-fox': 'fenna-fox',
  'malo-bear': 'malo-bear',
  'mina-cat': 'mina-cat',
  'paco-dog': 'paco-dog',
  sprout: 'miffy',
  sunbeam: 'miffy',
}

/** The avatar stored for each character a parent can choose. */
export const avatarOf: Readonly<Record<CharacterId, SelectableAvatarId>> = {
  'colin-mallard': 'colin-mallard',
  'fenna-fox': 'fenna-fox',
  'malo-bear': 'malo-bear',
  miffy: 'sprout',
  'mina-cat': 'mina-cat',
  'paco-dog': 'paco-dog',
}

export const characterNames: Readonly<Record<CharacterId, string>> = {
  'colin-mallard': 'Colin',
  'fenna-fox': 'Fenna',
  'malo-bear': 'Malo',
  miffy: 'Miffy',
  'mina-cat': 'Mina',
  'paco-dog': 'Paco',
}

export const characterOf = (avatarId: AvatarId): CharacterId => avatarCharacters[avatarId]

export const sceneOf = (character: CharacterId, scene: SceneId): Scene => ({
  height: scenes[scene].height,
  src: `/characters/${character}/${scenes[scene].file}`,
  width: scenes[scene].width,
})

export const avatarImage = (character: CharacterId) =>
  `/avatars/${character === 'miffy' ? 'miffy' : character}.png`

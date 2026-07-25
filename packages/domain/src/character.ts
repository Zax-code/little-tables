import { Schema } from 'effect'

import {
  FamilyProfiles,
  type ChildAvatarId,
  type SelectableChildAvatarId,
} from './family-profile.js'

export const CharacterIdSchema = Schema.Literal(
  'miffy',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
)
export type CharacterId = typeof CharacterIdSchema.Type

const avatarCharacters = {
  berry: 'miffy',
  bluebell: 'miffy',
  'colin-mallard': 'colin-mallard',
  'fenna-fox': 'fenna-fox',
  'malo-bear': 'malo-bear',
  'mina-cat': 'mina-cat',
  'paco-dog': 'paco-dog',
  sprout: 'miffy',
  sunbeam: 'miffy',
} as const satisfies Readonly<Record<ChildAvatarId, CharacterId>>

const selectableAvatarCharacters = {
  'colin-mallard': 'colin-mallard',
  'fenna-fox': 'fenna-fox',
  'malo-bear': 'malo-bear',
  'mina-cat': 'mina-cat',
  'paco-dog': 'paco-dog',
  sprout: 'miffy',
} as const satisfies Readonly<Record<SelectableChildAvatarId, CharacterId>>

export const Characters = {
  avatarIds: FamilyProfiles.avatarIds,
  characterIds: CharacterIdSchema.literals,
  defaultCharacterId: 'miffy',
  resolveAvatarId: (avatarId: ChildAvatarId): CharacterId => avatarCharacters[avatarId],
  selectableAvatarCharacters,
} as const

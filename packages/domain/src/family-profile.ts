import { Schema } from 'effect'

export const ChildAvatarIdSchema = Schema.Literal(
  'sprout',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
  'sunbeam',
  'bluebell',
  'berry',
)
export type ChildAvatarId = typeof ChildAvatarIdSchema.Type
export const SelectableChildAvatarIdSchema = Schema.Literal(
  'sprout',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
)
export type SelectableChildAvatarId = typeof SelectableChildAvatarIdSchema.Type

export const ChildProfileNameSchema = Schema.NonEmptyTrimmedString.pipe(
  Schema.filter((name) => Array.from(name).length <= 40, {
    message: () => 'Family member names must contain at most 40 characters',
  }),
)
export type ChildProfileName = typeof ChildProfileNameSchema.Type

export const ChildProfileSchema = Schema.Struct({
  avatarId: ChildAvatarIdSchema,
  id: Schema.NonEmptyString,
  name: ChildProfileNameSchema,
})
export type ChildProfile = typeof ChildProfileSchema.Type

const avatarIds = [
  'sprout',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
  'sunbeam',
  'bluebell',
  'berry',
] as const
const selectableAvatarIds = [
  'sprout',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
] as const

export const FamilyProfiles = {
  avatarIds,
  defaultAvatarId: avatarIds[0],
  selectableAvatarIds,
} as const

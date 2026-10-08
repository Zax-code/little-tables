import { Schema } from 'effect'

import { LearningPathSettingsSchema } from './exercises.js'

export const ChildAvatarIdSchema = Schema.Literals([
  'sprout',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
  'sunbeam',
  'bluebell',
  'berry',
])
export type ChildAvatarId = typeof ChildAvatarIdSchema.Type
export const SelectableChildAvatarIdSchema = Schema.Literals([
  'sprout',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
])
export type SelectableChildAvatarId = typeof SelectableChildAvatarIdSchema.Type

export const ChildProfileNameSchema = Schema.Trimmed.check(
  Schema.isNonEmpty(),
  Schema.makeFilter(
    (name) =>
      Array.from(name).length <= 40 || 'Family member names must contain at most 40 characters',
  ),
)
export type ChildProfileName = typeof ChildProfileNameSchema.Type

export const ChildProfileSchema = Schema.Struct({
  avatarId: ChildAvatarIdSchema,
  id: Schema.NonEmptyString,
  /** How additions, big numbers and fractions join practice. Absent means automatic. */
  learningPaths: Schema.optional(LearningPathSettingsSchema),
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

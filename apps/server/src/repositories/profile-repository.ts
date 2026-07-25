import {
  ChildAvatarIdSchema,
  ChildProfileNameSchema,
  type ChildAvatarId,
  type ChildProfile,
} from '@little-tables/domain'
import { Context, Data, type Effect } from 'effect'

export { ChildAvatarIdSchema, ChildProfileNameSchema }

export type FamilyAccount = Readonly<{
  googleSubject: string
  onboardingComplete: boolean
  profiles: ReadonlyArray<ChildProfile>
}>

export type RemoveChildResult = 'last-profile' | 'not-found' | 'removed'

export class ProfileRepositoryError extends Data.TaggedError('ProfileRepositoryError')<{
  cause: unknown
  operation:
    | 'add-child'
    | 'complete-initial-profile'
    | 'ensure-family'
    | 'find-family'
    | 'remove-child'
    | 'update-child'
}> {}

export type ProfileRepositoryService = Readonly<{
  addChild: (
    googleSubject: string,
    input: Readonly<{ avatarId: ChildAvatarId; name: string }>,
  ) => Effect.Effect<ChildProfile, ProfileRepositoryError>
  completeInitialProfile: (
    googleSubject: string,
    profileId: string,
    name: string,
  ) => Effect.Effect<boolean, ProfileRepositoryError>
  ensureFamily: (input: {
    fallbackName: string
    googleSubject: string
    legacyProfileId: string
  }) => Effect.Effect<FamilyAccount, ProfileRepositoryError>
  findFamily: (googleSubject: string) => Effect.Effect<FamilyAccount | null, ProfileRepositoryError>
  removeChild: (
    googleSubject: string,
    profileId: string,
  ) => Effect.Effect<RemoveChildResult, ProfileRepositoryError>
  updateChild: (
    googleSubject: string,
    profileId: string,
    input: Readonly<{ avatarId: ChildAvatarId; name: string }>,
  ) => Effect.Effect<ChildProfile | null, ProfileRepositoryError>
}>

export class ProfileRepository extends Context.Tag('@little-tables/ProfileRepository')<
  ProfileRepository,
  ProfileRepositoryService
>() {}

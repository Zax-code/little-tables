import { Context, Data, Schema, type Effect } from 'effect'

export const PreferredDisplayNameSchema = Schema.NonEmptyTrimmedString.pipe(
  Schema.filter((displayName) => Array.from(displayName).length <= 40, {
    message: () => 'Preferred names must contain at most 40 characters',
  }),
)

export class ProfileRepositoryError extends Data.TaggedError('ProfileRepositoryError')<{
  cause: unknown
  operation: 'find-preferred-name' | 'save-preferred-name'
}> {}

export type ProfileRepositoryService = Readonly<{
  findPreferredName: (googleSubject: string) => Effect.Effect<string | null, ProfileRepositoryError>
  savePreferredName: (
    googleSubject: string,
    displayName: typeof PreferredDisplayNameSchema.Type,
  ) => Effect.Effect<boolean, ProfileRepositoryError>
}>

export class ProfileRepository extends Context.Tag('@little-tables/ProfileRepository')<
  ProfileRepository,
  ProfileRepositoryService
>() {}

import { Context, Data, type Effect } from 'effect'

export class AllowedEmailRepositoryError extends Data.TaggedError('AllowedEmailRepositoryError')<{
  cause: unknown
  operation: 'add' | 'contains' | 'list'
}> {}

export type AllowedEmailRepositoryService = Readonly<{
  add: (email: string, addedBy: string) => Effect.Effect<boolean, AllowedEmailRepositoryError>
  contains: (email: string) => Effect.Effect<boolean, AllowedEmailRepositoryError>
  list: () => Effect.Effect<ReadonlyArray<string>, AllowedEmailRepositoryError>
}>

export class AllowedEmailRepository extends Context.Tag('@little-tables/AllowedEmailRepository')<
  AllowedEmailRepository,
  AllowedEmailRepositoryService
>() {}

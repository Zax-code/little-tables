import { Context, Data, type Effect } from 'effect'

export class AllowedEmailRepositoryError extends Data.TaggedError('AllowedEmailRepositoryError')<{
  cause: unknown
  operation: 'add' | 'contains' | 'isBlocked' | 'list' | 'listBlocked' | 'remove' | 'sessionVersion'
}> {}

export type AllowedEmailRepositoryService = Readonly<{
  add: (email: string, addedBy: string) => Effect.Effect<boolean, AllowedEmailRepositoryError>
  contains: (email: string) => Effect.Effect<boolean, AllowedEmailRepositoryError>
  isBlocked: (email: string) => Effect.Effect<boolean, AllowedEmailRepositoryError>
  list: () => Effect.Effect<ReadonlyArray<string>, AllowedEmailRepositoryError>
  listBlocked: () => Effect.Effect<ReadonlyArray<string>, AllowedEmailRepositoryError>
  remove: (email: string, removedBy: string) => Effect.Effect<void, AllowedEmailRepositoryError>
  sessionVersion: (email: string) => Effect.Effect<number, AllowedEmailRepositoryError>
}>

export class AllowedEmailRepository extends Context.Tag('@little-tables/AllowedEmailRepository')<
  AllowedEmailRepository,
  AllowedEmailRepositoryService
>() {}

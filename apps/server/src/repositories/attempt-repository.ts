import type { AttemptEvent } from '@little-tables/domain'
import { Context, Data, type Effect } from 'effect'

export class AttemptRepositoryError extends Data.TaggedError('AttemptRepositoryError')<{
  cause: unknown
  operation: 'insert' | 'list'
}> {}

export type AttemptInsertResult = Readonly<{
  accepted: ReadonlyArray<string>
  duplicates: ReadonlyArray<string>
}>

export type AttemptRepositoryService = Readonly<{
  insert: (
    profileId: string,
    attempts: ReadonlyArray<AttemptEvent>,
  ) => Effect.Effect<AttemptInsertResult, AttemptRepositoryError>
  list: (profileId: string) => Effect.Effect<ReadonlyArray<AttemptEvent>, AttemptRepositoryError>
}>

export class AttemptRepository extends Context.Tag('@little-tables/AttemptRepository')<
  AttemptRepository,
  AttemptRepositoryService
>() {}

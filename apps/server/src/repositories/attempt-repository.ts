import type { AttemptEvent } from '@little-tables/domain'
import { Context, Data, type Effect } from 'effect'

export class AttemptRepositoryError extends Data.TaggedError('AttemptRepositoryError')<{
  cause: unknown
  operation: 'consume-invite' | 'health' | 'insert' | 'list'
}> {}

export type AttemptInsertResult = Readonly<{
  accepted: ReadonlyArray<string>
  duplicates: ReadonlyArray<string>
}>

export type AttemptRepositoryService = Readonly<{
  consumeInvite: (inviteId: string) => Effect.Effect<boolean, AttemptRepositoryError>
  health: Effect.Effect<void, AttemptRepositoryError>
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

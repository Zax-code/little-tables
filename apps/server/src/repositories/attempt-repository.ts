import type { AttemptEvent } from '@little-tables/domain'
import { Context, Data, type Effect } from 'effect'

export class AttemptRepositoryError extends Data.TaggedError('AttemptRepositoryError')<{
  cause: unknown
  operation:
    | 'consume-invite'
    | 'health'
    | 'insert'
    | 'list'
    | 'list-push-subscriptions'
    | 'mark-push-subscription-sent'
    | 'remove-push-subscription'
    | 'upsert-push-subscription'
}> {}

export type AttemptInsertResult = Readonly<{
  accepted: ReadonlyArray<string>
  duplicates: ReadonlyArray<string>
}>

export type PushSubscriptionRecord = Readonly<{
  endpoint: string
  expirationTime: number | null
  keys: Readonly<{ auth: string; p256dh: string }>
  lastSentDayKey: string | null
  profileId: string
  reminderHour: number
  timezone: string
}>

export type PushSubscriptionInput = Omit<PushSubscriptionRecord, 'lastSentDayKey' | 'profileId'>

export type AttemptRepositoryService = Readonly<{
  consumeInvite: (inviteId: string) => Effect.Effect<boolean, AttemptRepositoryError>
  health: Effect.Effect<void, AttemptRepositoryError>
  insert: (
    profileId: string,
    attempts: ReadonlyArray<AttemptEvent>,
  ) => Effect.Effect<AttemptInsertResult, AttemptRepositoryError>
  list: (profileId: string) => Effect.Effect<ReadonlyArray<AttemptEvent>, AttemptRepositoryError>
  listPushSubscriptions: () => Effect.Effect<
    ReadonlyArray<PushSubscriptionRecord>,
    AttemptRepositoryError
  >
  markPushSubscriptionSent: (
    endpoint: string,
    dayKey: string,
  ) => Effect.Effect<void, AttemptRepositoryError>
  removePushSubscription: (endpoint: string) => Effect.Effect<void, AttemptRepositoryError>
  upsertPushSubscription: (
    profileId: string,
    subscription: PushSubscriptionInput,
  ) => Effect.Effect<void, AttemptRepositoryError>
}>

export class AttemptRepository extends Context.Tag('@little-tables/AttemptRepository')<
  AttemptRepository,
  AttemptRepositoryService
>() {}

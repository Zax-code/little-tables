import type {
  AttemptEvent,
  Ce2Attempt,
  Ce2PreferenceUpdate,
  Ce2Preferences,
} from '@little-tables/domain'
import { Context, Data, Schema, type Effect } from 'effect'

export class AttemptRepositoryError extends Data.TaggedError('AttemptRepositoryError')<{
  cause: unknown
  operation:
    | 'health'
    | 'insert'
    | 'insert-ce2'
    | 'list'
    | 'list-ce2'
    | 'list-push-subscriptions'
    | 'mark-push-subscription-sent'
    | 'remove-push-subscription'
    | 'load-ce2-preferences'
    | 'merge-ce2-preferences'
    | 'upsert-push-subscription'
}> {}

export type AttemptInsertResult = Readonly<{
  accepted: ReadonlyArray<string>
  duplicates: ReadonlyArray<string>
}>

export const ReminderLocaleSchema = Schema.Literal('en', 'fr', 'zh-Hans')
export type ReminderLocale = typeof ReminderLocaleSchema.Type

export type PushSubscriptionRecord = Readonly<{
  endpoint: string
  expirationTime: number | null
  keys: Readonly<{ auth: string; p256dh: string }>
  lastSentDayKey: string | null
  locale: ReminderLocale
  profileId: string
  reminderHour: number
  timezone: string
}>

export type PushSubscriptionInput = Omit<PushSubscriptionRecord, 'lastSentDayKey' | 'profileId'>

export type AttemptRepositoryService = Readonly<{
  health: Effect.Effect<void, AttemptRepositoryError>
  insert: (
    profileId: string,
    attempts: ReadonlyArray<AttemptEvent>,
  ) => Effect.Effect<AttemptInsertResult, AttemptRepositoryError>
  list: (profileId: string) => Effect.Effect<ReadonlyArray<AttemptEvent>, AttemptRepositoryError>
  insertCe2?: (
    profileId: string,
    attempts: ReadonlyArray<Ce2Attempt>,
  ) => Effect.Effect<AttemptInsertResult, AttemptRepositoryError>
  listCe2?: (profileId: string) => Effect.Effect<ReadonlyArray<Ce2Attempt>, AttemptRepositoryError>
  loadCe2Preferences?: (profileId: string) => Effect.Effect<Ce2Preferences, AttemptRepositoryError>
  mergeCe2Preferences?: (
    profileId: string,
    updates: ReadonlyArray<Ce2PreferenceUpdate>,
  ) => Effect.Effect<AttemptInsertResult, AttemptRepositoryError>
  listPushSubscriptions: () => Effect.Effect<
    ReadonlyArray<PushSubscriptionRecord>,
    AttemptRepositoryError
  >
  markPushSubscriptionSent: (
    endpoint: string,
    dayKey: string,
  ) => Effect.Effect<void, AttemptRepositoryError>
  removePushSubscription: (
    profileId: string,
    endpoint: string,
  ) => Effect.Effect<void, AttemptRepositoryError>
  upsertPushSubscription: (
    profileId: string,
    subscription: PushSubscriptionInput,
  ) => Effect.Effect<void, AttemptRepositoryError>
}>

export class AttemptRepository extends Context.Tag('@little-tables/AttemptRepository')<
  AttemptRepository,
  AttemptRepositoryService
>() {}

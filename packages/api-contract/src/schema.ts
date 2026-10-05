/**
 * Responses and requests of `/api/v2`, written by hand to mirror `crates/lt-server/src/v2.rs`.
 * `contract.test.ts` decodes responses recorded from the Rust server with them, so a change on
 * either side fails CI. Instants are Unix milliseconds.
 */
import {
  AttemptEvent,
  GardenReward,
  LearningPathSettings,
  LearningSnapshot,
  Millis,
} from '@little-tables/engine/schema'
import { Schema } from 'effect'

const Int = Schema.Number.pipe(Schema.int())
const DayKey = Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/))

export const AvatarId = Schema.Literal(
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
export type AvatarId = typeof AvatarId.Type

/** The characters a parent can choose; the others are kept for older profiles. */
export const SelectableAvatarId = Schema.Literal(
  'sprout',
  'malo-bear',
  'fenna-fox',
  'mina-cat',
  'paco-dog',
  'colin-mallard',
)
export type SelectableAvatarId = typeof SelectableAvatarId.Type

export const ChildName = Schema.Trim.pipe(
  Schema.nonEmptyString(),
  Schema.filter((name) => Array.from(name).length <= 40, {
    message: () => 'A name has at most 40 characters',
  }),
)

export const ReminderLocale = Schema.Literal('en', 'fr', 'zh-Hans')
export type ReminderLocale = typeof ReminderLocale.Type

export const AuthStatus = Schema.Struct({
  authenticated: Schema.Boolean,
  authenticationRequired: Schema.Boolean,
  email: Schema.NullOr(Schema.String),
  googleClientId: Schema.NullOr(Schema.String),
  isAdmin: Schema.Boolean,
  onboardingRequired: Schema.Boolean,
  sessionExpiresAt: Schema.NullOr(Millis),
})
export type AuthStatus = typeof AuthStatus.Type

export const SignIn = Schema.Struct({
  onboardingRequired: Schema.Boolean,
  status: Schema.Literal('authenticated'),
})

export const Refresh = Schema.Struct({
  sessionExpiresAt: Schema.NullOr(Millis),
  status: Schema.Literal('renewed'),
})

export const Logout = Schema.Struct({ status: Schema.Literal('signed-out') })

export const ChildProfile = Schema.Struct({
  avatarId: AvatarId,
  id: Schema.NonEmptyString,
  learningPaths: LearningPathSettings,
  name: Schema.String,
  /** Minutes after local midnight; `null` when the reminder is off. */
  reminderMinute: Schema.NullOr(Int),
})
export type ChildProfile = typeof ChildProfile.Type

export const ProfileResponse = Schema.Struct({ profile: ChildProfile })
export const ProfilesResponse = Schema.Struct({ profiles: Schema.Array(ChildProfile) })
export const RemovedProfile = Schema.Struct({ removedProfileId: Schema.NonEmptyString })

export const GardenCollection = Schema.Struct({
  awardedFlowerIds: Schema.Array(Schema.String),
  bloomsPerFlower: Int,
  catalogVersion: Schema.Literal('1'),
  flowerOrder: Schema.Array(Schema.String),
  introductionSeen: Schema.Boolean,
})
export type GardenCollection = typeof GardenCollection.Type

export const Bootstrap = Schema.Struct({
  completedSessions: Int,
  gardenBloomCount: Int,
  gardenCollection: GardenCollection,
  practiceDayKeys: Schema.Array(DayKey),
  profile: ChildProfile,
  rewardedDayKeys: Schema.Array(DayKey),
  rewards: Schema.Array(GardenReward),
  snapshot: LearningSnapshot,
})
export type Bootstrap = typeof Bootstrap.Type

export const RejectionReason = Schema.Literal(
  'duplicate_in_batch',
  'duplicate_sequence',
  'inconsistent_attempt',
  'invalid_answer',
)

export const SyncResult = Schema.Struct({
  accepted: Schema.Array(Schema.String),
  duplicates: Schema.Array(Schema.String),
  rejected: Schema.Array(Schema.Struct({ eventId: Schema.String, reason: RejectionReason })),
})
export type SyncResult = typeof SyncResult.Type

export const AttemptBatch = Schema.Struct({
  attempts: Schema.Array(AttemptEvent).pipe(Schema.maxItems(100)),
})

export const IntroductionSeen = Schema.Struct({ introductionSeen: Schema.Literal(true) })
export const NotificationConfig = Schema.Struct({ publicKey: Schema.String })
export const Subscribed = Schema.Struct({ status: Schema.Literal('subscribed') })
export const Unsubscribed = Schema.Struct({ status: Schema.Literal('unsubscribed') })

export const PushSubscriptionInput = Schema.Struct({
  endpoint: Schema.String,
  expirationTime: Schema.NullOr(Schema.Number),
  keys: Schema.Struct({ auth: Schema.String, p256dh: Schema.String }),
  locale: ReminderLocale,
  timezone: Schema.String,
})
export type PushSubscriptionInput = typeof PushSubscriptionInput.Type

export const AllowedEmails = Schema.Struct({
  emails: Schema.Array(Schema.Struct({ admin: Schema.Boolean, email: Schema.String })),
})
export const EmailAdded = Schema.Struct({ created: Schema.Boolean, email: Schema.String })
export const EmailRemoved = Schema.Struct({ email: Schema.String, removed: Schema.Boolean })

/** Every response of the contract, by the name the Rust test records it under. */
export const responses = {
  addEmail: EmailAdded,
  attempts: SyncResult,
  authStatus: AuthStatus,
  authStatusSignedOut: AuthStatus,
  bootstrap: Bootstrap,
  createProfile: ProfileResponse,
  introductionSeen: IntroductionSeen,
  listEmails: AllowedEmails,
  listProfiles: ProfilesResponse,
  logout: Logout,
  onboarding: ProfileResponse,
  refresh: Refresh,
  removeEmail: EmailRemoved,
  removeProfile: RemovedProfile,
  signIn: SignIn,
  subscribe: Subscribed,
  unsubscribe: Unsubscribed,
  updateLearningPaths: ProfileResponse,
  updateProfile: ProfileResponse,
} as const

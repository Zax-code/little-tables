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
  PracticeAnswer,
  SkillId,
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

export const ParentLockStatus = Schema.Struct({
  configured: Schema.Boolean,
  lockedUntil: Schema.NullOr(Millis),
  /** Changes with the code: a device whose copy has another salt must drop it. */
  pinSalt: Schema.NullOr(Schema.String),
})
export type ParentLockStatus = typeof ParentLockStatus.Type

/** What a device needs to check the parent code offline (PBKDF2, `docs/rewrite` §6.4). */
export const ParentLockDevice = Schema.Struct({
  pinHashParams: Schema.Struct({ hash: Schema.Literal('SHA-256'), iterations: Int }),
  pinSalt: Schema.String,
})
export type ParentLockDevice = typeof ParentLockDevice.Type

export const WrongPin = Schema.Struct({
  error: Schema.Literal('wrong_pin'),
  remainingAttempts: Int,
})
export const LockedPin = Schema.Struct({
  error: Schema.Literal('parent_lock_locked'),
  lockedUntil: Millis,
})

export const StruggleReason = Schema.Literal('mistakes', 'lapses', 'slow')
export type StruggleReason = typeof StruggleReason.Type

export const Struggle = Schema.Struct({
  answers: Int,
  commonWrongAnswer: Schema.NullOr(PracticeAnswer),
  factKey: Schema.String,
  lapses: Int,
  medianLatencyMs: Schema.NullOr(Schema.Number),
  mistakes: Int,
  reasons: Schema.Array(StruggleReason),
  skill: Schema.NullOr(SkillId),
})
export type Struggle = typeof Struggle.Type

/** "What's hard" for a parent, over the last 7 or 30 learning days (`docs/rewrite` §5.6). */
export const Insights = Schema.Struct({
  answers: Int,
  correctAnswers: Int,
  fromDayKey: DayKey,
  growth: Schema.Struct({
    becameFamiliar: Schema.Array(Schema.String),
    becameFluent: Schema.Array(Schema.String),
  }),
  regularity: Schema.Struct({
    bloomingWeeks: Int,
    practicedDays: Int,
    rangeDays: Int,
    weeks: Int,
  }),
  struggles: Schema.Array(Struggle),
  timeSpentMs: Int,
  toDayKey: DayKey,
  wellOnTheWay: Schema.Struct({ skills: Schema.Array(SkillId), tables: Schema.Array(Int) }),
})
export type Insights = typeof Insights.Type

/** Every response of the contract, by the name the Rust test records it under. */
export const responses = {
  addEmail: EmailAdded,
  attempts: SyncResult,
  authStatus: AuthStatus,
  authStatusSignedOut: AuthStatus,
  bootstrap: Bootstrap,
  createProfile: ProfileResponse,
  insights: Insights,
  introductionSeen: IntroductionSeen,
  listEmails: AllowedEmails,
  listProfiles: ProfilesResponse,
  lockedPin: LockedPin,
  logout: Logout,
  onboarding: ProfileResponse,
  parentLockStatus: ParentLockStatus,
  parentLockUnset: ParentLockStatus,
  refresh: Refresh,
  removeEmail: EmailRemoved,
  removeProfile: RemovedProfile,
  resetParentLock: ParentLockStatus,
  setParentLock: ParentLockDevice,
  signIn: SignIn,
  subscribe: Subscribed,
  unsubscribe: Unsubscribed,
  updateLearningPaths: ProfileResponse,
  updateProfile: ProfileResponse,
  verifyParentLock: ParentLockDevice,
  wrongPin: WrongPin,
} as const

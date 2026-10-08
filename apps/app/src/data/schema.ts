/**
 * What the app keeps on the device. Everything read back from IndexedDB or `localStorage` is
 * decoded with these schemas; instants are Unix milliseconds, as in the engine.
 */
import { ApiSchema } from '@little-tables/api-contract'
import {
  LearningSnapshot,
  PracticeAnswer,
  PracticeSession,
  SessionInsight,
  SessionKind,
} from '@little-tables/engine/schema'
import { Schema } from 'effect'

const Int = Schema.Number.pipe(Schema.int())
const Millis = Int

export const SessionCompletion = Schema.Struct({
  bloomNumber: Int,
  completedAt: Millis,
  correctAnswers: Int,
  /** The answer to the last question: a number for facts, any answer for exercises. */
  finalExpected: Schema.Union(Schema.Number, PracticeAnswer),
  finalCorrect: Schema.Boolean,
  gardenBloomEarned: Schema.Boolean,
  learningDayKey: Schema.String,
  learningInsight: SessionInsight,
  /** Whether this meadow watering was the meadow's bloom of the day; absent before the meadow. */
  meadowBloomEarned: Schema.optional(Schema.Boolean),
  /** The verb the session brought a butterfly to; absent on summaries written before. */
  meadowVisit: Schema.optional(Schema.NullOr(Schema.String)),
  sessionId: Schema.String,
  sessionKind: SessionKind,
  totalAnswers: Int,
})
export type SessionCompletion = typeof SessionCompletion.Type

export const ProfileState = Schema.Struct({
  activeSession: Schema.NullOr(PracticeSession),
  completedSessions: Int,
  gardenBloomCount: Int,
  gardenCollection: ApiSchema.GardenCollection,
  lastCompletion: Schema.NullOr(SessionCompletion),
  /** The meadow's blooms, one per day with a meadow watering; absent on states saved before. */
  meadowBloomCount: Schema.optional(Int),
  meadowRewardedDayKeys: Schema.optional(Schema.Array(Schema.String)),
  practiceDayKeys: Schema.Array(Schema.String),
  rewardedDayKeys: Schema.Array(Schema.String),
  /** The snapshot when the active session started, to describe what it changed. */
  sessionStartSnapshot: Schema.NullOr(LearningSnapshot),
  snapshot: LearningSnapshot,
})
export type ProfileState = typeof ProfileState.Type

export const SyncMeta = Schema.Struct({
  /** The database of the previous app this one was copied from, deleted after a sync. */
  legacyDatabase: Schema.NullOr(Schema.String),
  /** Old events that could not be read; the old database is then kept for inspection. */
  legacySkippedEvents: Int,
  lastRejections: Schema.Array(Schema.Struct({ eventId: Schema.String, reason: Schema.String })),
  lastSyncedAt: Schema.NullOr(Millis),
  rejectedCount: Int,
})
export type SyncMeta = typeof SyncMeta.Type

export const emptyMeta: SyncMeta = {
  lastRejections: [],
  lastSyncedAt: null,
  legacyDatabase: null,
  legacySkippedEvents: 0,
  rejectedCount: 0,
}

export const Language = Schema.Literal('fr', 'en', 'zh-Hans')
export type Language = typeof Language.Type

export const Preferences = Schema.Struct({
  appearance: Schema.Literal('system', 'light', 'dark'),
  language: Language,
  sound: Schema.Boolean,
  textSize: Schema.Literal('default', 'large', 'larger'),
})
export type Preferences = typeof Preferences.Type

export const defaultPreferences: Preferences = {
  appearance: 'light',
  language: 'fr',
  sound: true,
  textSize: 'default',
}

/** Lets the app open without network until the session cookie would expire. */
export const AuthGrant = Schema.Struct({
  email: Schema.NullOr(Schema.String),
  expiresAt: Millis,
  isAdmin: Schema.Boolean,
  onboardingRequired: Schema.Boolean,
})
export type AuthGrant = typeof AuthGrant.Type

export const ProfilesCache = Schema.Array(ApiSchema.ChildProfile)

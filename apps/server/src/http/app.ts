import {
  CE2_CONTENT_VERSION,
  Ce2AttemptWireSchema,
  Ce2Engine,
  Ce2PreferenceUpdateWireSchema,
  ChildProfileNameSchema,
  LearningEngine,
  SelectableChildAvatarIdSchema,
} from '@little-tables/domain'
import { HttpRouter, HttpServerRequest, HttpServerResponse } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'

import { AccessControl } from '../application/access-control.js'
import {
  AllowedEmailAccess,
  AllowedEmailAccessError,
  administratorEmail,
} from '../application/allowed-email-access.js'
import { AttemptIngestion } from '../application/attempt-ingestion.js'
import { Ce2AttemptIngestion } from '../application/ce2-attempt-ingestion.js'
import { verifyGoogleCredential } from '../application/google-identity.js'
import { Identity } from '../application/identity.js'
import { LegacyProfileMigration } from '../application/legacy-profile-migration.js'
import { AttemptRepository, ReminderLocaleSchema } from '../repositories/attempt-repository.js'
import { GardenCollectionRepository } from '../repositories/garden-collection-repository.js'
import { ProfileRepository } from '../repositories/profile-repository.js'

const AttemptEventSchema = Schema.Struct({
  answerMode: Schema.Literal('choice', 'keypad'),
  answeredAt: Schema.DateFromString,
  choices: Schema.Array(Schema.Int),
  correct: Schema.Boolean,
  eventId: Schema.NonEmptyString,
  factKey: Schema.NonEmptyString,
  latencyMs: Schema.NonNegativeInt,
  learningDayKey: Schema.optionalWith(Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/)), {
    exact: true,
  }),
  left: Schema.Int.pipe(Schema.between(1, 144)),
  operation: Schema.optionalWith(Schema.Literal('multiply', 'divide'), {
    default: () => 'multiply' as const,
  }),
  right: Schema.Int.pipe(Schema.between(1, 12)),
  questionCount: Schema.Int.pipe(Schema.between(1, 100)),
  selected: Schema.NonNegativeInt,
  sequence: Schema.NonNegativeInt,
  sessionId: Schema.NonEmptyString,
  sessionKind: Schema.optionalWith(Schema.Literal('daily-watering', 'extra-practice'), {
    exact: true,
  }),
})

const SyncRequestSchema = Schema.Struct({
  attempts: Schema.Array(AttemptEventSchema).pipe(Schema.maxItems(100)),
  profileId: Schema.NonEmptyString,
})

const Ce2SyncRequestSchema = Schema.Struct({
  attempts: Schema.Array(Ce2AttemptWireSchema).pipe(Schema.maxItems(100)),
  preferenceUpdates: Schema.Array(Ce2PreferenceUpdateWireSchema).pipe(Schema.maxItems(100)),
  profileId: Schema.NonEmptyString,
})

const Ce2PreferenceRequestSchema = Schema.Struct({
  profileId: Schema.NonEmptyString,
  update: Ce2PreferenceUpdateWireSchema,
})

const GoogleCredentialSchema = Schema.Struct({ credential: Schema.NonEmptyString })
const PreferredNameSchema = Schema.Struct({ displayName: Schema.String })
const CreateChildProfileSchema = Schema.Struct({
  avatarId: SelectableChildAvatarIdSchema,
  name: Schema.String,
})
const UpdateChildProfileSchema = Schema.Struct({
  avatarId: SelectableChildAvatarIdSchema,
  name: Schema.String,
  profileId: Schema.NonEmptyString,
})
const RemoveChildProfileSchema = Schema.Struct({ profileId: Schema.NonEmptyString })
const AllowedEmailSchema = Schema.Struct({ email: Schema.String })
const PushSubscriptionSchema = Schema.Struct({
  endpoint: Schema.NonEmptyString,
  expirationTime: Schema.optionalWith(Schema.NullOr(Schema.NonNegative), {
    default: () => null,
  }),
  keys: Schema.Struct({ auth: Schema.NonEmptyString, p256dh: Schema.NonEmptyString }),
})
const SavePushSubscriptionSchema = Schema.Struct({
  locale: Schema.optionalWith(ReminderLocaleSchema, { default: () => 'fr' as const }),
  subscription: PushSubscriptionSchema,
  timezone: Schema.NonEmptyString,
})
const RemovePushSubscriptionSchema = Schema.Struct({ endpoint: Schema.NonEmptyString })
const googleAllowedEmails = (process.env.GOOGLE_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim())
  .filter((email) => email !== '')
const googleAuthConfig = process.env.GOOGLE_CLIENT_ID
  ? {
      allowedEmails: googleAllowedEmails,
      clientId: process.env.GOOGLE_CLIENT_ID,
    }
  : null
const authConfig =
  process.env.SESSION_SECRET && googleAuthConfig !== null
    ? {
        google: googleAuthConfig,
        secret: process.env.SESSION_SECRET,
      }
    : null
const defaultWebDistPath = fileURLToPath(new URL('../../../web/dist', import.meta.url))
const webDistPath = resolve(process.env.WEB_DIST_PATH ?? defaultWebDistPath)
const appRevision = process.env.APP_REVISION ?? 'unknown'

const json = (body: unknown, status = 200) => HttpServerResponse.json(body, { status })

const sessionCookie = (response: HttpServerResponse.HttpServerResponse, session: string) =>
  HttpServerResponse.unsafeSetCookie(response, 'little-tables-session', session, {
    httpOnly: true,
    maxAge: '30 days',
    path: '/',
    sameSite: 'lax',
    secure: true,
  })

const authorizedIdentity = Effect.gen(function* () {
  if (authConfig === null) {
    return {
      authMethod: 'google',
      displayName: 'léa',
      email: administratorEmail,
      expiresAt: null,
      googleSubject: 'development',
      nameChoiceRequired: false,
      profileId: 'lou',
      sessionVersion: 0,
    } as const
  }
  const request = yield* HttpServerRequest.HttpServerRequest
  const session = request.cookies['little-tables-session']
  if (session === undefined) return null
  const identity = Identity.verify({ now: new Date(), secret: authConfig.secret, session })
  if (identity === null) return null
  const allowed = yield* AllowedEmailAccess.isSessionAllowed(
    identity.email,
    identity.sessionVersion,
    authConfig.google.allowedEmails,
  ).pipe(Effect.catchAll(() => Effect.succeed(false)))
  return allowed ? identity : null
})

const authorizedProfile = (requestedProfileId?: string) =>
  Effect.gen(function* () {
    const identity = yield* authorizedIdentity
    if (identity === null) return null
    const request = yield* HttpServerRequest.HttpServerRequest
    const selectedProfileId = requestedProfileId ?? request.headers['x-little-tables-profile-id']
    if (authConfig === null) return selectedProfileId ?? identity.profileId
    const profiles = yield* ProfileRepository
    const family = yield* profiles.findFamily(identity.googleSubject)
    if (family === null) return null
    if (selectedProfileId !== undefined) {
      return family.profiles.some(({ id }) => id === selectedProfileId) ? selectedProfileId : null
    }
    return family.profiles.some(({ id }) => id === identity.profileId)
      ? identity.profileId
      : (family.profiles[0]?.id ?? null)
  })

const authStatus = Effect.gen(function* () {
  const identity = yield* authorizedIdentity
  return yield* json({
    authenticated: identity !== null,
    authenticationRequired: authConfig !== null,
    displayName: identity?.displayName ?? null,
    googleClientId: authConfig?.google.clientId ?? null,
    isAdmin:
      authConfig !== null &&
      identity !== null &&
      AllowedEmailAccess.isAdministrator(identity.email),
    nameChoiceRequired: identity?.nameChoiceRequired ?? false,
    profileId: identity?.profileId ?? null,
    sessionExpiresAt: identity?.expiresAt ?? null,
  })
})

const googleSignIn = Effect.gen(function* () {
  const google = authConfig?.google
  const secret = authConfig?.secret
  if (google === undefined || secret === undefined) {
    return yield* json({ error: 'google_auth_unavailable' }, 404)
  }
  const { credential } = yield* HttpServerRequest.schemaBodyJson(GoogleCredentialSchema)
  const identity = yield* Effect.tryPromise(() =>
    verifyGoogleCredential({
      clientId: google.clientId,
      credential,
    }),
  )
  if (identity === null) return yield* json({ error: 'invalid_google_credential' }, 401)
  const allowed = yield* AllowedEmailAccess.isAllowed(identity.email, google.allowedEmails)
  if (!allowed) return yield* json({ error: 'google_account_not_allowed' }, 401)
  const profiles = yield* ProfileRepository
  const fallbackName = Array.from(identity.displayName).slice(0, 40).join('')
  if (!Schema.is(ChildProfileNameSchema)(fallbackName)) {
    return yield* json({ error: 'invalid_google_credential' }, 401)
  }
  const family = yield* profiles.ensureFamily({
    retainLegacyProfileId: LegacyProfileMigration.retainSharedProfileId(identity.email),
    fallbackName,
    googleSubject: identity.subject,
    legacyProfileId: identity.profileId,
  })
  const initialProfile = family.profiles[0]
  if (initialProfile === undefined) return yield* json({ error: 'profile_unavailable' }, 503)
  const sessionVersion = yield* AllowedEmailAccess.sessionVersion(identity.email)
  const session = Identity.issue({
    authMethod: 'google',
    displayName: initialProfile.name,
    email: identity.email,
    googleSubject: identity.subject,
    nameChoiceRequired: !family.onboardingComplete,
    now: new Date(),
    profileId: initialProfile.id,
    secret,
    sessionVersion,
  })
  return sessionCookie(
    yield* json({ profileId: initialProfile.id, status: 'authenticated' }),
    session,
  )
}).pipe(Effect.catchAll(() => json({ error: 'invalid_google_credential' }, 401)))

const savePreferredName = Effect.gen(function* () {
  if (authConfig === null) return yield* json({ error: 'unauthorized' }, 401)
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  if (!identity.nameChoiceRequired) return yield* json({ error: 'name_already_chosen' }, 409)
  const body = yield* HttpServerRequest.schemaBodyJson(PreferredNameSchema).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
  )
  if (body === null) return yield* json({ error: 'invalid_display_name' }, 400)
  const displayName = body.displayName.trim()
  if (!Schema.is(ChildProfileNameSchema)(displayName)) {
    return yield* json({ error: 'invalid_display_name' }, 400)
  }
  const profiles = yield* ProfileRepository
  const existingFamily = yield* profiles.findFamily(identity.googleSubject)
  const family =
    existingFamily ??
    (yield* profiles.ensureFamily({
      retainLegacyProfileId: LegacyProfileMigration.retainSharedProfileId(identity.email),
      fallbackName: displayName,
      googleSubject: identity.googleSubject,
      legacyProfileId: identity.profileId,
    }))
  const initialProfile =
    family.profiles.find(({ id }) => id === identity.profileId) ?? family.profiles[0]
  if (initialProfile === undefined) return yield* json({ error: 'display_name_save_failed' }, 503)
  const saved = yield* profiles.completeInitialProfile(
    identity.googleSubject,
    initialProfile.id,
    displayName,
  )
  if (!saved) return yield* json({ error: 'name_already_chosen' }, 409)
  const session = Identity.issue({
    authMethod: identity.authMethod,
    displayName,
    email: identity.email,
    googleSubject: identity.googleSubject,
    nameChoiceRequired: false,
    now: new Date(),
    profileId: initialProfile.id,
    secret: authConfig.secret,
    sessionVersion: identity.sessionVersion,
  })
  return sessionCookie(yield* json({ displayName }), session)
}).pipe(Effect.catchAll(() => json({ error: 'display_name_save_failed' }, 503)))

const listAllowedEmails = Effect.gen(function* () {
  if (authConfig === null) return yield* json({ error: 'unauthorized' }, 401)
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  if (!AllowedEmailAccess.isAdministrator(identity.email)) {
    return yield* json({ error: 'forbidden' }, 403)
  }
  const emails = yield* AllowedEmailAccess.list({
    actorEmail: identity.email,
    configuredEmails: googleAllowedEmails,
  })
  return yield* json({ emails })
}).pipe(Effect.catchAll(() => json({ error: 'allowed_emails_unavailable' }, 503)))

const addAllowedEmail = Effect.gen(function* () {
  if (authConfig === null) return yield* json({ error: 'unauthorized' }, 401)
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  if (!AllowedEmailAccess.isAdministrator(identity.email)) {
    return yield* json({ error: 'forbidden' }, 403)
  }
  const body = yield* HttpServerRequest.schemaBodyJson(AllowedEmailSchema).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
  )
  if (body === null) return yield* json({ error: 'invalid_email' }, 400)
  const result = yield* AllowedEmailAccess.add({ actorEmail: identity.email, email: body.email })
  return yield* json(result, result.created ? 201 : 200)
}).pipe(
  Effect.catchAll((error) =>
    error instanceof AllowedEmailAccessError && error.reason === 'invalid_email'
      ? json({ error: 'invalid_email' }, 400)
      : json({ error: 'allowed_email_save_failed' }, 503),
  ),
)

const removeAllowedEmail = Effect.gen(function* () {
  if (authConfig === null) return yield* json({ error: 'unauthorized' }, 401)
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  if (!AllowedEmailAccess.isAdministrator(identity.email)) {
    return yield* json({ error: 'forbidden' }, 403)
  }
  const body = yield* HttpServerRequest.schemaBodyJson(AllowedEmailSchema).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
  )
  if (body === null) return yield* json({ error: 'invalid_email' }, 400)
  const result = yield* AllowedEmailAccess.remove({
    actorEmail: identity.email,
    configuredEmails: googleAllowedEmails,
    email: body.email,
  })
  return yield* json(result)
}).pipe(
  Effect.catchAll((error) => {
    if (error instanceof AllowedEmailAccessError) {
      if (error.reason === 'invalid_email') return json({ error: 'invalid_email' }, 400)
      if (error.reason === 'protected_email') return json({ error: 'protected_email' }, 409)
    }
    return json({ error: 'allowed_email_remove_failed' }, 503)
  }),
)

const refreshSession = Effect.gen(function* () {
  if (authConfig === null) return yield* json({ status: 'development_auth_disabled' })
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  const request = yield* HttpServerRequest.HttpServerRequest
  const current = request.cookies['little-tables-session']
  if (current === undefined) return yield* json({ error: 'unauthorized' }, 401)
  const renewed = Identity.renew({ now: new Date(), secret: authConfig.secret, session: current })
  if (renewed === null) return yield* json({ error: 'unauthorized' }, 401)
  return sessionCookie(yield* json({ status: 'renewed' }), renewed)
})

const ready = Effect.gen(function* () {
  const attemptRepository = yield* AttemptRepository
  const gardenRepository = yield* GardenCollectionRepository
  yield* Effect.all([attemptRepository.health, gardenRepository.health])
  return yield* json({ revision: appRevision, status: 'ready' })
}).pipe(Effect.catchAll(() => json({ status: 'unavailable' }, 503)))

const sync = Effect.gen(function* () {
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  const request = yield* HttpServerRequest.schemaBodyJson(SyncRequestSchema)
  const profileId = yield* authorizedProfile(request.profileId)
  if (profileId === null) return yield* json({ error: 'profile_forbidden' }, 403)
  const result = yield* AttemptIngestion.ingest({ ...request, profileId })
  return yield* json(result)
}).pipe(
  Effect.catchAll((error) =>
    json(
      {
        error: 'invalid_sync_request',
        message:
          error instanceof Error ? error.message : 'The sync request could not be processed.',
      },
      400,
    ),
  ),
)

const syncCe2 = Effect.gen(function* () {
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  const request = yield* HttpServerRequest.schemaBodyJson(Ce2SyncRequestSchema)
  const profileId = yield* authorizedProfile(request.profileId)
  if (profileId === null) return yield* json({ error: 'profile_forbidden' }, 403)
  const result = yield* Ce2AttemptIngestion.ingest({ ...request, profileId })
  return yield* json(result)
}).pipe(
  Effect.catchAll((error) =>
    json(
      {
        error: 'invalid_sync_request',
        message:
          error instanceof Error ? error.message : 'The sync request could not be processed.',
      },
      400,
    ),
  ),
)

const saveCe2Preferences = Effect.gen(function* () {
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  const request = yield* HttpServerRequest.schemaBodyJson(Ce2PreferenceRequestSchema)
  const profileId = yield* authorizedProfile(request.profileId)
  if (profileId === null) return yield* json({ error: 'profile_forbidden' }, 403)
  const repository = yield* AttemptRepository
  if (repository.mergeCe2Preferences === undefined || repository.loadCe2Preferences === undefined) {
    return yield* json({ error: 'ce2_unavailable' }, 503)
  }
  const result = yield* repository.mergeCe2Preferences(profileId, [request.update])
  const preferences = yield* repository.loadCe2Preferences(profileId)
  return yield* json({ ...result, preferences })
}).pipe(Effect.catchAll(() => json({ error: 'invalid_preferences_request' }, 400)))

const bootstrapFor = (includeCe2: boolean) =>
  Effect.gen(function* () {
    const identity = yield* authorizedIdentity
    if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
    const profileId = yield* authorizedProfile()
    if (profileId === null) return yield* json({ error: 'profile_forbidden' }, 403)
    const profiles = yield* ProfileRepository
    const family = yield* profiles.findFamily(identity.googleSubject)
    const profileDisplayName =
      family?.profiles.find(({ id }) => id === profileId)?.name ?? identity.displayName
    const repository = yield* AttemptRepository
    const gardenRepository = yield* GardenCollectionRepository
    const attempts = yield* repository.list(profileId)
    const ce2Attempts = repository.listCe2 === undefined ? [] : yield* repository.listCe2(profileId)
    const snapshot = LearningEngine.reduce({ attempts, snapshot: LearningEngine.emptySnapshot() })
    const completedAttemptBySession = new Map<string, (typeof attempts)[number]>()
    for (const attempt of attempts) {
      if (
        attempt.sequence === attempt.questionCount - 1 &&
        !completedAttemptBySession.has(attempt.sessionId)
      ) {
        completedAttemptBySession.set(attempt.sessionId, attempt)
      }
    }
    const completedAttempts = [...completedAttemptBySession.values()]
    const completedCe2AttemptBySession = new Map<string, (typeof ce2Attempts)[number]>()
    for (const attempt of ce2Attempts) {
      if (
        attempt.sequence === attempt.questionCount - 1 &&
        !completedCe2AttemptBySession.has(attempt.sessionId)
      ) {
        completedCe2AttemptBySession.set(attempt.sessionId, attempt)
      }
    }
    const completedCe2Attempts = [...completedCe2AttemptBySession.values()]
    const completedSessions = completedAttempts.length + completedCe2Attempts.length
    const dayKeyFor = ({
      answeredAt,
      learningDayKey,
    }: Readonly<{
      answeredAt: Date
      learningDayKey?: string | undefined
    }>) => learningDayKey ?? answeredAt.toISOString().slice(0, 10)
    const practiceDayKeys = [...new Set([...attempts, ...ce2Attempts].map(dayKeyFor))].sort()
    const derivedGardenRewards = LearningEngine.deriveGardenRewardLedger({
      completions: [
        ...completedAttempts.map((attempt) => ({
          learningDayKey: dayKeyFor(attempt),
          sessionKind: attempt.sessionKind,
        })),
        ...completedCe2Attempts.map((attempt) => ({
          learningDayKey: dayKeyFor(attempt),
          sessionKind:
            attempt.sessionKind === 'daily-watering'
              ? ('daily-watering' as const)
              : ('extra-practice' as const),
        })),
      ],
    })
    const legacyFlowerPrefixLength =
      derivedGardenRewards.gardenBloomCount === 0
        ? 0
        : Math.min(
            LearningEngine.gardenFlowerIds.length,
            Math.ceil(derivedGardenRewards.gardenBloomCount / 5),
          )
    const initialCollection = yield* gardenRepository.loadOrCreate({
      preferredFlowerPrefix: LearningEngine.gardenFlowerIds.slice(0, legacyFlowerPrefixLength),
      profileId,
    })
    const gardenRewards = LearningEngine.mergeGardenRewardLedgers({
      ledgers: [
        derivedGardenRewards,
        {
          gardenBloomCount: initialCollection.bloomCount,
          rewardedDayKeys: initialCollection.rewardedDayKeys,
        },
      ],
    })
    const gardenProgress = LearningEngine.deriveGardenProgress({
      awardedFlowerIds: initialCollection.awardedFlowerIds,
      completedSessions: gardenRewards.gardenBloomCount,
      flowerOrder: initialCollection.flowerOrder,
      snapshot,
    })
    const collection = yield* gardenRepository.reconcile(profileId, {
      awardedFlowerIds: [
        ...initialCollection.awardedFlowerIds,
        ...gardenProgress.plants.filter(({ stage }) => stage === 'mature').map(({ id }) => id),
      ],
      bloomCount: gardenRewards.gardenBloomCount,
      rewardedDayKeys: gardenRewards.rewardedDayKeys,
    })
    const ce2Snapshot = Ce2Engine.reduce({
      attempts: ce2Attempts,
      snapshot: Ce2Engine.emptySnapshot(),
    })
    const ce2Preferences =
      repository.loadCe2Preferences === undefined
        ? {
            enabledModules: [],
            lastDailyFamily: null,
            schemaVersion: 'ce2-preferences/v1' as const,
            updatedAt: new Date(0),
          }
        : yield* repository.loadCe2Preferences(profileId)
    return yield* json({
      algorithmVersion: snapshot.algorithmVersion,
      profile: { displayName: profileDisplayName, id: profileId },
      completedSessions,
      gardenBloomCount: gardenRewards.gardenBloomCount,
      gardenCollection: {
        awardedFlowerIds: collection.awardedFlowerIds,
        bloomsPerFlower: collection.bloomsPerFlower,
        catalogVersion: collection.catalogVersion,
        flowerOrder: collection.flowerOrder,
        introductionSeen: collection.introductionSeen,
      },
      practiceDayKeys,
      rewardedDayKeys: gardenRewards.rewardedDayKeys,
      rewards: LearningEngine.deriveRewards({
        awardedFlowerIds: collection.awardedFlowerIds,
        completedSessions: gardenRewards.gardenBloomCount,
        flowerOrder: collection.flowerOrder,
        snapshot,
      }),
      snapshot,
      ...(includeCe2
        ? {
            capabilities: {
              ce2: {
                attemptSchemaVersion: 'ce2-attempt/v1',
                contentVersion: CE2_CONTENT_VERSION,
              },
            },
            ce2ContentVersion: CE2_CONTENT_VERSION,
            ce2Preferences,
            ce2Snapshot,
          }
        : {}),
    })
  }).pipe(Effect.catchAll(() => json({ error: 'bootstrap_unavailable' }, 503)))

const bootstrap = bootstrapFor(false)
const bootstrapCe2 = bootstrapFor(true)

const markGardenIntroductionSeen = Effect.gen(function* () {
  const profileId = yield* authorizedProfile()
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const repository = yield* GardenCollectionRepository
  yield* repository.markIntroductionSeen(profileId)
  return yield* json({ introductionSeen: true })
}).pipe(Effect.catchAll(() => json({ error: 'garden_introduction_update_failed' }, 503)))

const notificationConfig = Effect.gen(function* () {
  const profileId = yield* authorizedProfile()
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (publicKey === undefined) return yield* json({ error: 'unavailable' }, 503)
  return yield* json({ publicKey, reminderHour: 18 })
})

const savePushSubscription = Effect.gen(function* () {
  const profileId = yield* authorizedProfile()
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const { locale, subscription, timezone } = yield* HttpServerRequest.schemaBodyJson(
    SavePushSubscriptionSchema,
  )
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
  } catch {
    return yield* json({ error: 'invalid_timezone' }, 400)
  }
  const repository = yield* AttemptRepository
  yield* repository.upsertPushSubscription(profileId, {
    ...subscription,
    locale,
    reminderHour: 18,
    timezone,
  })
  return yield* json({ reminderHour: 18, status: 'subscribed', timezone })
}).pipe(Effect.catchAll(() => json({ error: 'invalid_subscription_request' }, 400)))

const removePushSubscription = Effect.gen(function* () {
  const profileId = yield* authorizedProfile()
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const { endpoint } = yield* HttpServerRequest.schemaBodyJson(RemovePushSubscriptionSchema)
  const repository = yield* AttemptRepository
  yield* repository.removePushSubscription(profileId, endpoint)
  return yield* json({ status: 'unsubscribed' })
}).pipe(Effect.catchAll(() => json({ error: 'invalid_subscription_request' }, 400)))

const familyForIdentity = Effect.gen(function* () {
  const identity = yield* authorizedIdentity
  if (identity === null) return null
  const profiles = yield* ProfileRepository
  const family = yield* profiles.findFamily(identity.googleSubject)
  if (family !== null) return { family, identity, profiles }
  const fallbackName = Array.from(identity.displayName).slice(0, 40).join('')
  if (!Schema.is(ChildProfileNameSchema)(fallbackName)) return null
  const created = yield* profiles.ensureFamily({
    retainLegacyProfileId: LegacyProfileMigration.retainSharedProfileId(identity.email),
    fallbackName,
    googleSubject: identity.googleSubject,
    legacyProfileId: identity.profileId,
  })
  return { family: created, identity, profiles }
})

const listFamilyProfiles = Effect.gen(function* () {
  const account = yield* familyForIdentity
  if (account === null) return yield* json({ error: 'unauthorized' }, 401)
  return yield* json({ profiles: account.family.profiles })
}).pipe(Effect.catchAll(() => json({ error: 'family_profiles_unavailable' }, 503)))

const createChildProfile = Effect.gen(function* () {
  const account = yield* familyForIdentity
  if (account === null) return yield* json({ error: 'unauthorized' }, 401)
  const body = yield* HttpServerRequest.schemaBodyJson(CreateChildProfileSchema).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
  )
  const name = body?.name.trim() ?? ''
  if (body === null || !Schema.is(ChildProfileNameSchema)(name)) {
    return yield* json({ error: 'invalid_child_profile' }, 400)
  }
  const profile = yield* account.profiles.addChild(account.identity.googleSubject, {
    avatarId: body.avatarId,
    name,
  })
  return yield* json({ profile }, 201)
}).pipe(Effect.catchAll(() => json({ error: 'family_profile_save_failed' }, 503)))

const updateChildProfile = Effect.gen(function* () {
  const account = yield* familyForIdentity
  if (account === null) return yield* json({ error: 'unauthorized' }, 401)
  const body = yield* HttpServerRequest.schemaBodyJson(UpdateChildProfileSchema).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
  )
  const name = body?.name.trim() ?? ''
  if (body === null || !Schema.is(ChildProfileNameSchema)(name)) {
    return yield* json({ error: 'invalid_child_profile' }, 400)
  }
  const profile = yield* account.profiles.updateChild(
    account.identity.googleSubject,
    body.profileId,
    { avatarId: body.avatarId, name },
  )
  return profile === null
    ? yield* json({ error: 'profile_not_found' }, 404)
    : yield* json({ profile })
}).pipe(Effect.catchAll(() => json({ error: 'family_profile_save_failed' }, 503)))

const removeChildProfile = Effect.gen(function* () {
  const account = yield* familyForIdentity
  if (account === null) return yield* json({ error: 'unauthorized' }, 401)
  const body = yield* HttpServerRequest.schemaBodyJson(RemoveChildProfileSchema).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
  )
  if (body === null) return yield* json({ error: 'invalid_child_profile' }, 400)
  const result = yield* account.profiles.removeChild(account.identity.googleSubject, body.profileId)
  if (result === 'last-profile') return yield* json({ error: 'last_profile_required' }, 409)
  if (result === 'not-found') return yield* json({ error: 'profile_not_found' }, 404)
  return yield* json({ removedProfileId: body.profileId })
}).pipe(Effect.catchAll(() => json({ error: 'family_profile_remove_failed' }, 503)))

const staticWebApp = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const pathname = new URL(request.url, 'http://little-tables.local').pathname
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))
  const requestedPath = resolve(webDistPath, relativePath)
  if (!requestedPath.startsWith(`${webDistPath}${sep}`) && requestedPath !== webDistPath) {
    return yield* json({ error: 'not_found' }, 404)
  }
  const assetExists = existsSync(requestedPath) && statSync(requestedPath).isFile()
  const isNavigation = pathname === '/' || !assetExists
  if (isNavigation) {
    const identity = yield* authorizedIdentity
    const location = AccessControl.navigationRedirect({
      authenticated: identity !== null,
      authenticationRequired: authConfig !== null,
      isNavigation,
      pathname,
    })
    if (location !== null) return yield* HttpServerResponse.redirect(location)
  }
  const target = assetExists ? requestedPath : resolve(webDistPath, 'index.html')
  if (!existsSync(target)) return yield* json({ error: 'web_build_not_found' }, 404)
  const response = yield* HttpServerResponse.file(target)
  return target.endsWith(`${sep}index.html`)
    ? HttpServerResponse.setHeader(response, 'cache-control', 'no-store')
    : response
}).pipe(Effect.catchAll(() => json({ error: 'not_found' }, 404)))

const baseHttpApp = HttpRouter.empty.pipe(
  HttpRouter.get('/health/live', json({ status: 'ok' })),
  HttpRouter.get('/health/ready', ready),
  HttpRouter.get('/api/v1/auth/status', authStatus),
  HttpRouter.post('/api/v1/auth/google', googleSignIn),
  HttpRouter.put('/api/v1/profile/name', savePreferredName),
  HttpRouter.get('/api/v1/family/profiles', listFamilyProfiles),
  HttpRouter.post('/api/v1/family/profiles', createChildProfile),
  HttpRouter.put('/api/v1/family/profiles', updateChildProfile),
  HttpRouter.del('/api/v1/family/profiles', removeChildProfile),
  HttpRouter.get('/api/v1/admin/allowed-emails', listAllowedEmails),
  HttpRouter.post('/api/v1/admin/allowed-emails', addAllowedEmail),
  HttpRouter.del('/api/v1/admin/allowed-emails', removeAllowedEmail),
  HttpRouter.post('/api/v1/session/refresh', refreshSession),
  HttpRouter.get('/api/v1/bootstrap', bootstrap),
  HttpRouter.get('/api/v2/bootstrap', bootstrapCe2),
)

export const httpApp = baseHttpApp.pipe(
  HttpRouter.post('/api/v1/garden/introduction-seen', markGardenIntroductionSeen),
  HttpRouter.post('/api/v1/attempts/sync', sync),
  HttpRouter.post('/api/v2/attempts/sync', syncCe2),
  HttpRouter.put('/api/v2/preferences', saveCe2Preferences),
  HttpRouter.get('/api/v1/notifications/config', notificationConfig),
  HttpRouter.post('/api/v1/notifications/subscriptions', savePushSubscription),
  HttpRouter.del('/api/v1/notifications/subscriptions', removePushSubscription),
  HttpRouter.get('/*', staticWebApp),
)

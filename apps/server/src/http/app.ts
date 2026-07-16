import { LearningEngine } from '@little-tables/domain'
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
import { verifyGoogleCredential } from '../application/google-identity.js'
import { Identity } from '../application/identity.js'
import { AttemptRepository, ReminderLocaleSchema } from '../repositories/attempt-repository.js'
import {
  PreferredDisplayNameSchema,
  ProfileRepository,
} from '../repositories/profile-repository.js'

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

const GoogleCredentialSchema = Schema.Struct({ credential: Schema.NonEmptyString })
const PreferredNameSchema = Schema.Struct({ displayName: Schema.String })
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

const authorizedProfile = authorizedIdentity.pipe(
  Effect.map((identity) => identity?.profileId ?? null),
)

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
  const preferredName = yield* profiles.findPreferredName(identity.subject)
  const sessionVersion = yield* AllowedEmailAccess.sessionVersion(identity.email)
  const session = Identity.issue({
    authMethod: 'google',
    displayName: preferredName ?? identity.displayName,
    email: identity.email,
    googleSubject: identity.subject,
    nameChoiceRequired: preferredName === null,
    now: new Date(),
    profileId: identity.profileId,
    secret,
    sessionVersion,
  })
  return sessionCookie(
    yield* json({ profileId: identity.profileId, status: 'authenticated' }),
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
  if (!Schema.is(PreferredDisplayNameSchema)(displayName)) {
    return yield* json({ error: 'invalid_display_name' }, 400)
  }
  const profiles = yield* ProfileRepository
  const saved = yield* profiles.savePreferredName(identity.googleSubject, displayName)
  if (!saved) return yield* json({ error: 'name_already_chosen' }, 409)
  const session = Identity.issue({
    authMethod: identity.authMethod,
    displayName,
    email: identity.email,
    googleSubject: identity.googleSubject,
    nameChoiceRequired: false,
    now: new Date(),
    profileId: identity.profileId,
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
  const repository = yield* AttemptRepository
  yield* repository.health
  return yield* json({ revision: appRevision, status: 'ready' })
}).pipe(Effect.catchAll(() => json({ status: 'unavailable' }, 503)))

const sync = Effect.gen(function* () {
  const profileId = yield* authorizedProfile
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const request = yield* HttpServerRequest.schemaBodyJson(SyncRequestSchema)
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

const bootstrap = Effect.gen(function* () {
  const identity = yield* authorizedIdentity
  if (identity === null) return yield* json({ error: 'unauthorized' }, 401)
  const repository = yield* AttemptRepository
  const attempts = yield* repository.list(identity.profileId)
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
  const completedSessions = completedAttempts.length
  const dayKeyFor = ({ answeredAt, learningDayKey }: (typeof attempts)[number]) =>
    learningDayKey ?? answeredAt.toISOString().slice(0, 10)
  const practiceDayKeys = [...new Set(attempts.map(dayKeyFor))].sort()
  const gardenRewards = LearningEngine.deriveGardenRewardLedger({
    completions: completedAttempts.map((attempt) => ({
      learningDayKey: dayKeyFor(attempt),
      sessionKind: attempt.sessionKind,
    })),
  })
  return yield* json({
    algorithmVersion: snapshot.algorithmVersion,
    profile: { displayName: identity.displayName, id: identity.profileId },
    completedSessions,
    gardenBloomCount: gardenRewards.gardenBloomCount,
    practiceDayKeys,
    rewardedDayKeys: gardenRewards.rewardedDayKeys,
    rewards: LearningEngine.deriveRewards({
      completedSessions: gardenRewards.gardenBloomCount,
      snapshot,
    }),
    snapshot,
  })
}).pipe(Effect.catchAll(() => json({ error: 'bootstrap_unavailable' }, 503)))

const notificationConfig = Effect.gen(function* () {
  const profileId = yield* authorizedProfile
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (publicKey === undefined) return yield* json({ error: 'unavailable' }, 503)
  return yield* json({ publicKey, reminderHour: 18 })
})

const savePushSubscription = Effect.gen(function* () {
  const profileId = yield* authorizedProfile
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
  const profileId = yield* authorizedProfile
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const { endpoint } = yield* HttpServerRequest.schemaBodyJson(RemovePushSubscriptionSchema)
  const repository = yield* AttemptRepository
  yield* repository.removePushSubscription(endpoint)
  return yield* json({ status: 'unsubscribed' })
}).pipe(Effect.catchAll(() => json({ error: 'invalid_subscription_request' }, 400)))

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

export const httpApp = HttpRouter.empty.pipe(
  HttpRouter.get('/health/live', json({ status: 'ok' })),
  HttpRouter.get('/health/ready', ready),
  HttpRouter.get('/api/v1/auth/status', authStatus),
  HttpRouter.post('/api/v1/auth/google', googleSignIn),
  HttpRouter.put('/api/v1/profile/name', savePreferredName),
  HttpRouter.get('/api/v1/admin/allowed-emails', listAllowedEmails),
  HttpRouter.post('/api/v1/admin/allowed-emails', addAllowedEmail),
  HttpRouter.del('/api/v1/admin/allowed-emails', removeAllowedEmail),
  HttpRouter.post('/api/v1/session/refresh', refreshSession),
  HttpRouter.get('/api/v1/bootstrap', bootstrap),
  HttpRouter.post('/api/v1/attempts/sync', sync),
  HttpRouter.get('/api/v1/notifications/config', notificationConfig),
  HttpRouter.post('/api/v1/notifications/subscriptions', savePushSubscription),
  HttpRouter.del('/api/v1/notifications/subscriptions', removePushSubscription),
  HttpRouter.get('/*', staticWebApp),
)

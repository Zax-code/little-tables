import { LearningEngine } from '@little-tables/domain'
import { HttpRouter, HttpServerRequest, HttpServerResponse } from '@effect/platform'
import { Effect, Schema } from 'effect'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'

import { AttemptIngestion } from '../application/attempt-ingestion.js'
import { Identity } from '../application/identity.js'
import { AttemptRepository } from '../repositories/attempt-repository.js'

const AttemptEventSchema = Schema.Struct({
  answerMode: Schema.Literal('choice', 'keypad'),
  answeredAt: Schema.DateFromString,
  choices: Schema.Array(Schema.Int),
  correct: Schema.Boolean,
  eventId: Schema.NonEmptyString,
  factKey: Schema.NonEmptyString,
  latencyMs: Schema.NonNegativeInt,
  left: Schema.Int.pipe(Schema.between(1, 12)),
  right: Schema.Int.pipe(Schema.between(1, 12)),
  questionCount: Schema.Int.pipe(Schema.between(1, 100)),
  selected: Schema.NonNegativeInt,
  sequence: Schema.NonNegativeInt,
  sessionId: Schema.NonEmptyString,
})

const SyncRequestSchema = Schema.Struct({
  attempts: Schema.Array(AttemptEventSchema).pipe(Schema.maxItems(100)),
  profileId: Schema.NonEmptyString,
})

const ClaimInviteSchema = Schema.Struct({ token: Schema.NonEmptyString })
const PushSubscriptionSchema = Schema.Struct({
  endpoint: Schema.NonEmptyString,
  expirationTime: Schema.NullOr(Schema.NonNegative),
  keys: Schema.Struct({ auth: Schema.NonEmptyString, p256dh: Schema.NonEmptyString }),
})
const SavePushSubscriptionSchema = Schema.Struct({
  subscription: PushSubscriptionSchema,
  timezone: Schema.NonEmptyString,
})
const RemovePushSubscriptionSchema = Schema.Struct({ endpoint: Schema.NonEmptyString })
const claimAttempts: number[] = []
const authConfig =
  process.env.INVITE_TOKEN && process.env.SESSION_SECRET
    ? { invite: process.env.INVITE_TOKEN, secret: process.env.SESSION_SECRET }
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

const authorizedProfile = Effect.gen(function* () {
  if (authConfig === null) return 'lou'
  const request = yield* HttpServerRequest.HttpServerRequest
  const session = request.cookies['little-tables-session']
  if (session === undefined) return null
  return Identity.verify({ now: new Date(), secret: authConfig.secret, session })?.profileId ?? null
})

const claimInvite = Effect.gen(function* () {
  const now = Date.now()
  while (claimAttempts[0] !== undefined && claimAttempts[0] < now - 60_000) claimAttempts.shift()
  if (claimAttempts.length >= 5) return yield* json({ error: 'invite_rate_limited' }, 429)
  claimAttempts.push(now)
  if (authConfig === null)
    return yield* json({ profileId: 'lou', status: 'development_auth_disabled' })
  const { token } = yield* HttpServerRequest.schemaBodyJson(ClaimInviteSchema)
  const session = Identity.claim({
    expectedInvite: authConfig.invite,
    invite: token,
    now: new Date(),
    secret: authConfig.secret,
  })
  if (session === null) return yield* json({ error: 'invalid_invite' }, 401)
  const repository = yield* AttemptRepository
  const consumed = yield* repository.consumeInvite(Identity.inviteId(token, authConfig.secret))
  if (!consumed) return yield* json({ error: 'invite_already_used' }, 401)
  const response = yield* json({ profileId: 'lou', status: 'claimed' })
  return sessionCookie(response, session)
}).pipe(Effect.catchAll(() => json({ error: 'invalid_invite_request' }, 400)))

const refreshSession = Effect.gen(function* () {
  if (authConfig === null) return yield* json({ status: 'development_auth_disabled' })
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
  const profileId = yield* authorizedProfile
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const repository = yield* AttemptRepository
  const attempts = yield* repository.list(profileId)
  const snapshot = LearningEngine.reduce({ attempts, snapshot: LearningEngine.emptySnapshot() })
  const completedSessions = new Set(
    attempts
      .filter(({ questionCount, sequence }) => sequence === questionCount - 1)
      .map(({ sessionId }) => sessionId),
  ).size
  const practiceDayKeys = [
    ...new Set(attempts.map(({ answeredAt }) => answeredAt.toISOString().slice(0, 10))),
  ]
  return yield* json({
    algorithmVersion: snapshot.algorithmVersion,
    profile: { displayName: 'lou', id: 'lou' },
    completedSessions,
    practiceDayKeys,
    rewards: LearningEngine.deriveRewards({ completedSessions, snapshot }),
    snapshot,
  })
}).pipe(Effect.catchAll(() => json({ error: 'bootstrap_unavailable' }, 503)))

const notificationConfig = Effect.sync(() => {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  return publicKey ? json({ publicKey, reminderHour: 18 }) : json({ error: 'unavailable' }, 503)
}).pipe(Effect.flatten)

const savePushSubscription = Effect.gen(function* () {
  const profileId = yield* authorizedProfile
  if (profileId === null) return yield* json({ error: 'unauthorized' }, 401)
  const { subscription, timezone } = yield* HttpServerRequest.schemaBodyJson(
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
  const target = assetExists ? requestedPath : resolve(webDistPath, 'index.html')
  if (!existsSync(target)) return yield* json({ error: 'web_build_not_found' }, 404)
  return yield* HttpServerResponse.file(target)
}).pipe(Effect.catchAll(() => json({ error: 'not_found' }, 404)))

export const httpApp = HttpRouter.empty.pipe(
  HttpRouter.get('/health/live', json({ status: 'ok' })),
  HttpRouter.get('/health/ready', ready),
  HttpRouter.post('/api/v1/invites/claim', claimInvite),
  HttpRouter.post('/api/v1/session/refresh', refreshSession),
  HttpRouter.get('/api/v1/bootstrap', bootstrap),
  HttpRouter.post('/api/v1/attempts/sync', sync),
  HttpRouter.get('/api/v1/notifications/config', notificationConfig),
  HttpRouter.post('/api/v1/notifications/subscriptions', savePushSubscription),
  HttpRouter.del('/api/v1/notifications/subscriptions', removePushSubscription),
  HttpRouter.get('/*', staticWebApp),
)

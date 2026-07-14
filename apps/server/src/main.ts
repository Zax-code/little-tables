import { HttpServer } from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { createServer } from 'node:http'

import { httpApp } from './http/app.js'
import { DailyReminders } from './application/daily-reminders.js'
import { InMemoryAttemptRepository } from './repositories/in-memory-attempt-repository.js'
import { MongoAttemptRepository } from './repositories/mongo-attempt-repository.js'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '127.0.0.1'
const unsafeEphemeral = process.env.LITTLE_TABLES_UNSAFE_EPHEMERAL === 'true'
const googleConfigComplete = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_ALLOWED_EMAIL,
)
const googleConfigPartial =
  process.env.GOOGLE_CLIENT_ID !== undefined || process.env.GOOGLE_ALLOWED_EMAIL !== undefined
const vapidConfig =
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? {
        privateKey: process.env.VAPID_PRIVATE_KEY,
        publicKey: process.env.VAPID_PUBLIC_KEY,
        subject: process.env.VAPID_SUBJECT ?? 'https://math.leaetzak.love',
      }
    : null
if (googleConfigPartial && !googleConfigComplete) {
  throw new Error(
    'Google authentication requires GOOGLE_CLIENT_ID and GOOGLE_ALLOWED_EMAIL together.',
  )
}
if (
  process.env.NODE_ENV === 'production' &&
  !unsafeEphemeral &&
  (!process.env.MONGODB_URI ||
    !process.env.SESSION_SECRET ||
    (!process.env.INVITE_TOKEN && !googleConfigComplete) ||
    vapidConfig === null)
) {
  throw new Error(
    'Production requires MONGODB_URI, SESSION_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and at least one authentication method: INVITE_TOKEN or GOOGLE_CLIENT_ID with GOOGLE_ALLOWED_EMAIL. Set LITTLE_TABLES_UNSAFE_EPHEMERAL=true only for an explicit disposable smoke test.',
  )
}
const repositoryLayer = process.env.MONGODB_URI
  ? MongoAttemptRepository.layer(process.env.MONGODB_URI, process.env.MONGODB_DATABASE)
  : InMemoryAttemptRepository.layer()

const httpLayer = HttpServer.serve(httpApp).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { host, port })),
)

const applicationLayer = (
  vapidConfig === null ? httpLayer : Layer.merge(httpLayer, DailyReminders.layer(vapidConfig))
).pipe(Layer.provide(repositoryLayer))

const program: Effect.Effect<never> = Layer.launch(applicationLayer).pipe(Effect.orDie)
NodeRuntime.runMain(program)

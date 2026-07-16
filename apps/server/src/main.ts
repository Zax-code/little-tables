import { HttpServer } from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { createServer } from 'node:http'

import { httpApp } from './http/app.js'
import { DailyReminders } from './application/daily-reminders.js'
import { InMemoryAllowedEmailRepository } from './repositories/in-memory-allowed-email-repository.js'
import { InMemoryAttemptRepository } from './repositories/in-memory-attempt-repository.js'
import { InMemoryProfileRepository } from './repositories/in-memory-profile-repository.js'
import { MongoAllowedEmailRepository } from './repositories/mongo-allowed-email-repository.js'
import { MongoAttemptRepository } from './repositories/mongo-attempt-repository.js'
import { MongoProfileRepository } from './repositories/mongo-profile-repository.js'

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '127.0.0.1'
const unsafeEphemeral = process.env.LITTLE_TABLES_UNSAFE_EPHEMERAL === 'true'
const googleConfigComplete = Boolean(process.env.GOOGLE_CLIENT_ID)
const vapidConfig =
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? {
        privateKey: process.env.VAPID_PRIVATE_KEY,
        publicKey: process.env.VAPID_PUBLIC_KEY,
        subject: process.env.VAPID_SUBJECT ?? 'https://math.leaetzak.love',
      }
    : null
if (process.env.GOOGLE_ALLOWED_EMAILS !== undefined && !googleConfigComplete) {
  throw new Error('GOOGLE_ALLOWED_EMAILS requires GOOGLE_CLIENT_ID.')
}
if (
  process.env.NODE_ENV === 'production' &&
  !unsafeEphemeral &&
  (!process.env.MONGODB_URI ||
    !process.env.SESSION_SECRET ||
    !googleConfigComplete ||
    vapidConfig === null)
) {
  throw new Error(
    'Production requires MONGODB_URI, SESSION_SECRET, GOOGLE_CLIENT_ID, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY. Set LITTLE_TABLES_UNSAFE_EPHEMERAL=true only for an explicit disposable smoke test.',
  )
}
const repositoryLayer = process.env.MONGODB_URI
  ? Layer.mergeAll(
      MongoAttemptRepository.layer(process.env.MONGODB_URI, process.env.MONGODB_DATABASE),
      MongoAllowedEmailRepository.layer(process.env.MONGODB_URI, process.env.MONGODB_DATABASE),
      MongoProfileRepository.layer(process.env.MONGODB_URI, process.env.MONGODB_DATABASE),
    )
  : Layer.mergeAll(
      InMemoryAttemptRepository.layer(),
      InMemoryAllowedEmailRepository.layer(),
      InMemoryProfileRepository.layer(),
    )

const httpLayer = HttpServer.serve(httpApp).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { host, port })),
)

const applicationLayer = (
  vapidConfig === null ? httpLayer : Layer.merge(httpLayer, DailyReminders.layer(vapidConfig))
).pipe(Layer.provide(repositoryLayer))

const program: Effect.Effect<never> = Layer.launch(applicationLayer).pipe(Effect.orDie)
NodeRuntime.runMain(program)

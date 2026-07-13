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
const vapidConfig =
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? {
        privateKey: process.env.VAPID_PRIVATE_KEY,
        publicKey: process.env.VAPID_PUBLIC_KEY,
        subject: process.env.VAPID_SUBJECT ?? 'https://math.leaetzak.love',
      }
    : null
if (
  process.env.NODE_ENV === 'production' &&
  !unsafeEphemeral &&
  (!process.env.MONGODB_URI ||
    !process.env.INVITE_TOKEN ||
    !process.env.SESSION_SECRET ||
    vapidConfig === null)
) {
  throw new Error(
    'Production requires MONGODB_URI, INVITE_TOKEN, SESSION_SECRET, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY. Set LITTLE_TABLES_UNSAFE_EPHEMERAL=true only for an explicit disposable smoke test.',
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

import { HttpServer } from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Layer } from 'effect'
import { createServer } from 'node:http'

import { httpApp } from './http/app.js'
import { InMemoryAttemptRepository } from './repositories/in-memory-attempt-repository.js'
import { MongoAttemptRepository } from './repositories/mongo-attempt-repository.js'

const port = Number(process.env.PORT ?? 3000)
const unsafeEphemeral = process.env.LITTLE_TABLES_UNSAFE_EPHEMERAL === 'true'
if (
  process.env.NODE_ENV === 'production' &&
  !unsafeEphemeral &&
  (!process.env.MONGODB_URI || !process.env.INVITE_TOKEN || !process.env.SESSION_SECRET)
) {
  throw new Error(
    'Production requires MONGODB_URI, INVITE_TOKEN, and SESSION_SECRET. Set LITTLE_TABLES_UNSAFE_EPHEMERAL=true only for an explicit disposable smoke test.',
  )
}
const repositoryLayer = process.env.MONGODB_URI
  ? MongoAttemptRepository.layer(process.env.MONGODB_URI, process.env.MONGODB_DATABASE)
  : InMemoryAttemptRepository.layer()

const serverLayer = HttpServer.serve(httpApp).pipe(
  Layer.provide(repositoryLayer),
  Layer.provide(NodeHttpServer.layer(createServer, { port })),
)

NodeRuntime.runMain(Layer.launch(serverLayer))

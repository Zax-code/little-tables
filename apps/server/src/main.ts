import { HttpServer } from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Layer } from 'effect'
import { createServer } from 'node:http'

import { httpApp } from './http/app.js'
import { InMemoryAttemptRepository } from './repositories/in-memory-attempt-repository.js'
import { MongoAttemptRepository } from './repositories/mongo-attempt-repository.js'

const port = Number(process.env.PORT ?? 3000)
const repositoryLayer = process.env.MONGODB_URI
  ? MongoAttemptRepository.layer(process.env.MONGODB_URI, process.env.MONGODB_DATABASE)
  : InMemoryAttemptRepository.layer()

const serverLayer = HttpServer.serve(httpApp).pipe(
  Layer.provide(repositoryLayer),
  Layer.provide(NodeHttpServer.layer(createServer, { port })),
)

NodeRuntime.runMain(Layer.launch(serverLayer))

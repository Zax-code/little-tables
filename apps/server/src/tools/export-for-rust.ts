/**
 * One-time export of the production MongoDB for the Rust server (lot 2 of the rewrite).
 *
 * Reads every collection without writing to MongoDB, then runs this server's own bootstrap
 * endpoint, unchanged, over in-memory copies of the data. The export holds each profile's
 * bootstrap as this server computes it; `little-tables admin import` recomputes them all and
 * refuses the switch over on any difference.
 *
 *   node dist/tools/export-for-rust.js > little-tables-export.json
 */
import { HttpApp } from '@effect/platform'
import { NodeHttpPlatform } from '@effect/platform-node'
import { ChildAvatarIdSchema, FamilyProfiles, type GardenPlantId } from '@little-tables/domain'
import { Effect, Layer, Schema } from 'effect'
import { MongoClient, type Db, type Document } from 'mongodb'
import { randomInt } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import {
  AttemptRepository,
  ReminderLocaleSchema,
  type AttemptRepositoryService,
} from '../repositories/attempt-repository.js'
import {
  GardenCollectionRepository,
  gardenCollectionCatalogVersion,
  personalizedFlowerOrder,
  type GardenCollectionRecord,
  type GardenCollectionRepositoryService,
} from '../repositories/garden-collection-repository.js'
import { InMemoryAllowedEmailRepository } from '../repositories/in-memory-allowed-email-repository.js'
import { InMemoryProfileRepository } from '../repositories/in-memory-profile-repository.js'

export const exportFormat = 'little-tables-export/1'

type GardenDocument = {
  awardedFlowerIds: GardenPlantId[]
  bloomCount: number
  bloomsPerFlower: number
  catalogVersion: string
  createdAt: Date
  flowerOrder: GardenPlantId[]
  introductionSeen: boolean
  profileId: string
  rewardedDayKeys: string[]
  updatedAt: Date
}

const time = (value: unknown, fallback: number): number =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? value.getTime() : fallback

/** The garden repository with MongoDB's semantics, over an in-memory copy. */
const gardenRepository = (
  gardens: Map<string, GardenDocument>,
): GardenCollectionRepositoryService => {
  const record = (document: GardenDocument): GardenCollectionRecord => ({
    ...document,
    awardedFlowerIds: document.flowerOrder.filter((id) => document.awardedFlowerIds.includes(id)),
    bloomsPerFlower: 3,
    catalogVersion: gardenCollectionCatalogVersion,
  })
  const addToSet = <T>(target: T[], values: ReadonlyArray<T>) => {
    for (const value of values) if (!target.includes(value)) target.push(value)
  }
  return {
    health: Effect.void,
    loadOrCreate: ({ preferredFlowerPrefix, profileId }) =>
      Effect.sync(() => {
        const existing = gardens.get(profileId)
        if (existing !== undefined) return record(existing)
        const now = new Date()
        const created: GardenDocument = {
          awardedFlowerIds: [],
          bloomCount: 0,
          bloomsPerFlower: 3,
          catalogVersion: gardenCollectionCatalogVersion,
          createdAt: now,
          flowerOrder: [...personalizedFlowerOrder(preferredFlowerPrefix, randomInt)],
          introductionSeen: false,
          profileId,
          rewardedDayKeys: [],
          updatedAt: now,
        }
        gardens.set(profileId, created)
        return record(created)
      }),
    markIntroductionSeen: () => Effect.die(new Error('The export never marks introductions.')),
    reconcile: (profileId, reconciliation) =>
      Effect.sync(() => {
        const document = gardens.get(profileId)
        if (document === undefined) throw new Error('Garden collection does not exist')
        addToSet(document.awardedFlowerIds, reconciliation.awardedFlowerIds)
        addToSet(document.rewardedDayKeys, reconciliation.rewardedDayKeys)
        document.bloomCount = Math.max(document.bloomCount, reconciliation.bloomCount)
        document.updatedAt = new Date()
        return record(document)
      }),
  }
}

const attemptRepository = (
  attemptsByProfile: Map<string, Document[]>,
): AttemptRepositoryService => {
  const unused = () => Effect.die(new Error('The export only reads attempts.'))
  return {
    health: Effect.void,
    insert: unused,
    list: (profileId) => Effect.sync(() => (attemptsByProfile.get(profileId) ?? []) as never),
    listPushSubscriptions: unused,
    markPushSubscriptionSent: unused,
    removePushSubscription: unused,
    upsertPushSubscription: unused,
  }
}

/** This server's HTTP app, loaded with Google sign-in off so that any profile can be read. */
const loadApp = async () => {
  for (const name of [
    'GOOGLE_ALLOWED_EMAILS',
    'GOOGLE_CLIENT_ID',
    'SESSION_SECRET',
    'VAPID_PRIVATE_KEY',
    'VAPID_PUBLIC_KEY',
  ]) {
    Reflect.deleteProperty(process.env, name)
  }
  return (await import('../http/app.js')).httpApp
}

export const exportDatabase = async (db: Db) => {
  const problems: string[] = []
  const families: unknown[] = []
  const legacyProfileDocuments: string[] = []
  const profileNames = new Map<string, string>()
  for (const document of await db.collection('profiles').find().sort({ _id: 1 }).toArray()) {
    const subject = String(document._id)
    if (document.schemaVersion !== 2 || !Array.isArray(document.profiles)) {
      if (typeof document.displayName === 'string') legacyProfileDocuments.push(subject)
      else problems.push(`profiles/${subject}: unknown document shape`)
      continue
    }
    const children = document.profiles as Document[]
    families.push({
      createdAt: Math.min(
        ...children.map((child) => time(child.createdAt, time(document.updatedAt, Date.now()))),
      ),
      googleSubject: subject,
      onboardingComplete: document.onboardingComplete === true,
      profiles: children.map((child) => {
        profileNames.set(String(child.id), String(child.name))
        return {
          avatarId: Schema.is(ChildAvatarIdSchema)(child.avatarId)
            ? child.avatarId
            : FamilyProfiles.defaultAvatarId,
          id: String(child.id),
          ...(child.learningPaths === undefined
            ? {}
            : { learningPaths: child.learningPaths as unknown }),
          name: String(child.name),
        }
      }),
    })
  }

  const attemptsByProfile = new Map<string, Document[]>()
  const attempts: unknown[] = []
  const cursor = db
    .collection('attempt_events')
    .find()
    .sort({ profileId: 1, 'attempt.answeredAt': 1, 'attempt.sequence': 1 })
  for await (const document of cursor) {
    const profileId = String(document.profileId)
    const attempt = document.attempt as Document
    const list = attemptsByProfile.get(profileId) ?? []
    list.push(attempt)
    attemptsByProfile.set(profileId, list)
    attempts.push({
      attempt,
      profileId,
      receivedAt: time(document.receivedAt, 0),
    })
  }

  const gardens = new Map<string, GardenDocument>()
  for (const document of await db.collection('garden_collections').find().toArray()) {
    gardens.set(String(document._id), {
      awardedFlowerIds: [...(document.awardedFlowerIds as GardenPlantId[])],
      bloomCount: Number(document.bloomCount),
      bloomsPerFlower: Number(document.bloomsPerFlower),
      catalogVersion: String(document.catalogVersion),
      createdAt: document.createdAt as Date,
      flowerOrder: [...(document.flowerOrder as GardenPlantId[])],
      introductionSeen: document.introductionSeen === true,
      profileId: String(document._id),
      rewardedDayKeys: [...(document.rewardedDayKeys as string[])],
      updatedAt: document.updatedAt as Date,
    })
  }

  const httpApp = await loadApp()
  const { dispose, handler } = HttpApp.toWebHandlerLayer(
    httpApp,
    Layer.mergeAll(
      NodeHttpPlatform.layer,
      Layer.succeed(AttemptRepository, attemptRepository(attemptsByProfile)),
      Layer.succeed(GardenCollectionRepository, gardenRepository(gardens)),
      InMemoryAllowedEmailRepository.layer(),
      InMemoryProfileRepository.layer(),
    ),
  )
  const expectedBootstraps: unknown[] = []
  for (const [profileId, name] of profileNames) {
    const response = await handler(
      new Request('http://little-tables.local/api/v1/bootstrap', {
        headers: { 'x-little-tables-profile-id': profileId },
      }),
    )
    if (response.status !== 200) {
      problems.push(`bootstrap of ${profileId}: status ${response.status}`)
      continue
    }
    const bootstrap = (await response.json()) as { profile: { displayName: string } }
    bootstrap.profile.displayName = name
    expectedBootstraps.push({ bootstrap, profileId })
  }
  await dispose()

  const allowedEmails = (
    await db.collection('allowed_emails').find().sort({ _id: 1 }).toArray()
  ).map((document) => ({
    email: String(document._id),
    sessionVersion: typeof document.sessionVersion === 'number' ? document.sessionVersion : 0,
    status: document.status === 'blocked' ? 'blocked' : 'allowed',
  }))
  const pushSubscriptions = (await db.collection('push_subscriptions').find().toArray()).map(
    (document) => {
      const keys = (document.keys ?? {}) as Readonly<{ auth?: unknown; p256dh?: unknown }>
      return {
        endpoint: String(document._id),
        expirationTime:
          typeof document.expirationTime === 'number' ? document.expirationTime : null,
        keys: { auth: String(keys.auth), p256dh: String(keys.p256dh) },
        lastSentDayKey:
          typeof document.lastSentDayKey === 'string' ? document.lastSentDayKey : null,
        locale: Schema.is(ReminderLocaleSchema)(document.locale) ? document.locale : 'fr',
        profileId: String(document.profileId),
        timezone: String(document.timezone),
      }
    },
  )

  if (problems.length > 0) {
    throw new Error(`The export is incomplete:\n${problems.join('\n')}`)
  }
  return {
    allowedEmails,
    attempts,
    expectedBootstraps,
    exportedAt: new Date().toISOString(),
    families,
    format: exportFormat,
    // Gardens as this server leaves them after one bootstrap, which creates missing ones.
    gardens: [...gardens.values()].map((garden) => ({
      awardedFlowerIds: garden.awardedFlowerIds,
      bloomCount: garden.bloomCount,
      catalogVersion: garden.catalogVersion,
      createdAt: time(garden.createdAt, 0),
      flowerOrder: garden.flowerOrder,
      introductionSeen: garden.introductionSeen,
      profileId: garden.profileId,
      rewardedDayKeys: garden.rewardedDayKeys,
      updatedAt: time(garden.updatedAt, 0),
    })),
    legacyProfileDocuments,
    pushSubscriptions,
  }
}

const main = async () => {
  const uri = process.env.MONGODB_URI
  if (uri === undefined) throw new Error('MONGODB_URI is required.')
  const client = new MongoClient(uri, { readPreference: 'primary' })
  await client.connect()
  try {
    const result = await exportDatabase(client.db(process.env.MONGODB_DATABASE ?? 'little_tables'))
    process.stdout.write(JSON.stringify(result))
    process.stderr.write(
      `exported ${result.families.length} families, ${result.attempts.length} attempts, ` +
        `${result.expectedBootstraps.length} bootstraps\n`,
    )
  } finally {
    await client.close()
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}

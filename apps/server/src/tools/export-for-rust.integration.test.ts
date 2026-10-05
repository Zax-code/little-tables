import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb'
import { LearningEngine } from '@little-tables/domain'
import { MongoClient, type Db, type Document } from 'mongodb'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { exportDatabase, exportFormat } from './export-for-rust.js'

/** A raw document keyed by a string, as the previous server stored them. */
type Stored = Document & { _id: string }

const fixturePath = fileURLToPath(
  new URL('../../../../crates/lt-server/tests/fixtures/mongo-export.json', import.meta.url),
)

const fact = (
  eventId: string,
  sessionId: string,
  answeredAt: string,
  extra: Readonly<Record<string, unknown>> = {},
) => ({
  answerMode: 'keypad',
  answeredAt: new Date(answeredAt),
  choices: [],
  correct: true,
  eventId,
  factKey: '7:8',
  latencyMs: 1_700,
  left: 7,
  operation: 'multiply',
  questionCount: 2,
  right: 8,
  selected: 56,
  sequence: 0,
  sessionId,
  ...extra,
})

/** A production-like database: two families, practice over several days, gardens and access. */
const seed = async (db: Db) => {
  const created = new Date('2026-06-01T08:00:00.000Z')
  await db.collection<Stored>('profiles').insertMany([
    {
      _id: 'owner-subject',
      onboardingComplete: true,
      profiles: [
        { avatarId: 'mina-cat', createdAt: created, id: 'lou', name: 'Léa', updatedAt: created },
        // Written before avatars existed.
        { createdAt: created, id: 'tom', name: 'Tom', updatedAt: created },
      ],
      schemaVersion: 2,
      updatedAt: created,
    },
    {
      _id: 'friend-subject',
      onboardingComplete: false,
      profiles: [
        {
          avatarId: 'bluebell',
          createdAt: created,
          id: 'b0d5d1a4-2f1e-4b8e-9a43-3b2cf6a5b0a1',
          learningPaths: {
            enabledSkills: ['column-subtraction'],
            focusSkill: null,
            mode: 'manual',
            subtractionMethod: 'decomposition',
          },
          name: 'Mia',
          updatedAt: created,
        },
      ],
      schemaVersion: 2,
      updatedAt: created,
    },
  ])
  const attempts = [
    ['lou', fact('d1-q1', 'day-1', '2026-07-01T16:00:00.000Z', { learningDayKey: '2026-07-01' })],
    [
      'lou',
      fact('d1-q2', 'day-1', '2026-07-01T16:00:05.000Z', {
        learningDayKey: '2026-07-01',
        sequence: 1,
        sessionKind: 'daily-watering',
      }),
    ],
    ['lou', fact('d2-q1', 'day-2', '2026-07-02T23:30:00.000Z', { correct: false, selected: 54 })],
    ['lou', fact('d2-q2', 'day-2', '2026-07-02T23:30:09.000Z', { sequence: 1 })],
    [
      'lou',
      fact('extra', 'extra-1', '2026-07-03T10:00:00.000Z', {
        factKey: 'divide:56:7',
        left: 56,
        operation: 'divide',
        questionCount: 1,
        right: 7,
        selected: 8,
        sessionKind: 'extra-practice',
      }),
    ],
    [
      'b0d5d1a4-2f1e-4b8e-9a43-3b2cf6a5b0a1',
      fact('column', 'paths', '2026-07-04T09:00:00.000Z', {
        exercise: {
          kind: 'column',
          operation: 'subtract',
          skill: 'column-subtraction',
          terms: [503, 128],
        },
        factKey: 'column:sub:zero',
        latencyMs: 41_000,
        learningDayKey: '2026-07-04',
        left: 0,
        questionCount: 1,
        response: { type: 'integer', value: 375 },
        right: 0,
        selected: 375,
      }),
    ],
    // A child removed from its family keeps its events in MongoDB.
    ['removed-child', fact('orphan', 'gone', '2026-06-20T12:00:00.000Z')],
  ] as const
  await db.collection<Stored>('attempt_events').insertMany(
    attempts.map(([profileId, attempt]) => ({
      _id: attempt.eventId,
      attempt,
      profileId,
      receivedAt: new Date('2026-07-05T00:00:00.000Z'),
    })),
  )
  const order = [...LearningEngine.gardenFlowerIds].reverse()
  await db.collection<Stored>('garden_collections').insertMany([
    {
      _id: 'lou',
      awardedFlowerIds: [],
      bloomCount: 1,
      bloomsPerFlower: 3,
      catalogVersion: '1',
      createdAt: created,
      flowerOrder: order,
      introductionSeen: true,
      profileId: 'lou',
      rewardedDayKeys: ['2026-06-30'],
      updatedAt: created,
    },
    {
      _id: 'removed-child',
      awardedFlowerIds: [],
      bloomCount: 0,
      bloomsPerFlower: 3,
      catalogVersion: '1',
      createdAt: created,
      flowerOrder: order,
      introductionSeen: false,
      profileId: 'removed-child',
      rewardedDayKeys: [],
      updatedAt: created,
    },
  ])
  await db.collection<Stored>('allowed_emails').insertMany([
    { _id: 'friend@example.com', addedAt: created, addedBy: 'owner@example.com' },
    { _id: 'gone@example.com', sessionVersion: 2, status: 'blocked' },
  ])
  await db.collection<Stored>('push_subscriptions').insertOne({
    _id: 'https://push.example/lou',
    endpoint: 'https://push.example/lou',
    expirationTime: null,
    keys: { auth: 'auth', p256dh: 'p256dh' },
    lastSentDayKey: '2026-07-02',
    locale: 'de',
    profileId: 'lou',
    reminderHour: 18,
    timezone: 'Europe/Paris',
    updatedAt: created,
  })
}

describe('export for the Rust server', () => {
  let container: StartedMongoDBContainer | undefined
  let client: MongoClient | undefined

  beforeAll(async () => {
    container = await new MongoDBContainer('mongo:7.0.17').start()
    client = new MongoClient(container.getConnectionString(), { directConnection: true })
    await client.connect()
  }, 120_000)

  afterAll(async () => {
    await client?.close()
    await container?.stop()
  })

  it('exports every record and the expected bootstraps without writing to MongoDB', async () => {
    if (client === undefined) throw new Error('MongoDB did not start')
    const db = client.db('little_tables')
    await seed(db)
    const before = await db.collection('garden_collections').find().sort({ _id: 1 }).toArray()

    const result = await exportDatabase(db)

    expect(result.format).toBe(exportFormat)
    expect(result.legacyProfileDocuments).toEqual([])
    expect(result.families).toHaveLength(2)
    expect(result.families[1]).toMatchObject({
      googleSubject: 'owner-subject',
      onboardingComplete: true,
      profiles: [
        { avatarId: 'mina-cat', id: 'lou', name: 'Léa' },
        { avatarId: 'sprout', id: 'tom', name: 'Tom' },
      ],
    })
    expect(result.attempts).toHaveLength(7)
    expect(result.expectedBootstraps).toHaveLength(3)
    const lou = result.expectedBootstraps.find(
      (entry) => (entry as { profileId: string }).profileId === 'lou',
    ) as { bootstrap: Record<string, unknown> }
    expect(lou.bootstrap).toMatchObject({
      completedSessions: 3,
      gardenBloomCount: 3,
      practiceDayKeys: ['2026-07-01', '2026-07-02', '2026-07-03'],
      profile: { displayName: 'Léa', id: 'lou' },
      rewardedDayKeys: ['2026-06-30', '2026-07-01', '2026-07-02'],
    })
    // Missing gardens are created as the next bootstrap would; MongoDB itself is untouched.
    expect(result.gardens.map(({ profileId }) => profileId).sort()).toEqual(
      ['b0d5d1a4-2f1e-4b8e-9a43-3b2cf6a5b0a1', 'lou', 'removed-child', 'tom'].sort(),
    )
    expect(await db.collection('garden_collections').find().sort({ _id: 1 }).toArray()).toEqual(
      before,
    )
    expect(result.allowedEmails).toEqual([
      { email: 'friend@example.com', sessionVersion: 0, status: 'allowed' },
      { email: 'gone@example.com', sessionVersion: 2, status: 'blocked' },
    ])
    expect(result.pushSubscriptions).toEqual([
      expect.objectContaining({ lastSentDayKey: '2026-07-02', locale: 'fr', profileId: 'lou' }),
    ])

    // The Rust server's import test replays this export (`crates/lt-server/tests/import.rs`).
    if (process.env.WRITE_EXPORT_FIXTURE === '1') {
      mkdirSync(fileURLToPath(new URL('.', `file://${fixturePath}`)), { recursive: true })
      writeFileSync(fixturePath, `${JSON.stringify(result, null, 2)}\n`)
    }
  }, 60_000)

  it('refuses profile documents from before family profiles', async () => {
    if (client === undefined) throw new Error('MongoDB did not start')
    const db = client.db('legacy')
    await db
      .collection<Stored>('profiles')
      .insertOne({ _id: 'old-subject', displayName: 'lou', updatedAt: new Date() })
    const result = await exportDatabase(db)
    expect(result.legacyProfileDocuments).toEqual(['old-subject'])
  }, 60_000)
})

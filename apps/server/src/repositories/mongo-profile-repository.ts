import {
  ChildAvatarIdSchema,
  ChildProfileSchema,
  ChildProfileNameSchema,
  FamilyProfiles,
  LearningPathSettingsSchema,
  type ChildAvatarId,
  type ChildProfileName,
} from '@little-tables/domain'
import { Effect, Layer, Schema } from 'effect'
import { MongoClient, type Collection, type Document } from 'mongodb'
import { randomUUID } from 'node:crypto'

import {
  ProfileRepository,
  ProfileRepositoryError,
  type FamilyAccount,
  type ProfileRepositoryService,
} from './profile-repository.js'

const ChildDocumentSchema = Schema.Struct({
  avatarId: Schema.NonEmptyString,
  createdAt: Schema.ValidDateFromSelf,
  id: Schema.NonEmptyString,
  learningPaths: Schema.optional(LearningPathSettingsSchema),
  name: ChildProfileNameSchema,
  updatedAt: Schema.ValidDateFromSelf,
})

const FamilyDocumentSchema = Schema.Struct({
  _id: Schema.NonEmptyString,
  onboardingComplete: Schema.Boolean,
  profiles: Schema.NonEmptyArray(ChildDocumentSchema),
  schemaVersion: Schema.Literal(2),
  updatedAt: Schema.ValidDateFromSelf,
})

const FamilyDocumentBeforeAvatarSelectionSchema = Schema.Struct({
  _id: Schema.NonEmptyString,
  onboardingComplete: Schema.Boolean,
  profiles: Schema.NonEmptyArray(
    Schema.Struct({
      avatarId: Schema.optional(Schema.NonEmptyString),
      createdAt: Schema.ValidDateFromSelf,
      id: Schema.NonEmptyString,
      name: ChildProfileNameSchema,
      updatedAt: Schema.ValidDateFromSelf,
    }),
  ),
  schemaVersion: Schema.Literal(2),
  updatedAt: Schema.ValidDateFromSelf,
})

const LegacyProfileDocumentSchema = Schema.Struct({
  _id: Schema.NonEmptyString,
  displayName: ChildProfileNameSchema,
  updatedAt: Schema.ValidDateFromSelf,
})

type ChildDocument = typeof ChildDocumentSchema.Type
type FamilyDocument = typeof FamilyDocumentSchema.Type
type ProfileStorageDocument = Document & {
  _id: string
  profiles?: ReadonlyArray<ChildDocument>
}

const accountFor = (document: FamilyDocument): FamilyAccount => ({
  googleSubject: document._id,
  onboardingComplete: document.onboardingComplete,
  profiles: document.profiles.map(({ avatarId, id, learningPaths, name }) => ({
    avatarId: Schema.is(ChildAvatarIdSchema)(avatarId) ? avatarId : FamilyProfiles.defaultAvatarId,
    id,
    ...(learningPaths === undefined ? {} : { learningPaths }),
    name,
  })),
})

const decodeFamily = async (value: unknown): Promise<FamilyDocument> =>
  Schema.decodeUnknownPromise(FamilyDocumentSchema)(value)

const migrateAvatarSelections = async (
  collection: Collection<ProfileStorageDocument>,
  value: unknown,
): Promise<FamilyDocument | null> => {
  if (!Schema.is(FamilyDocumentBeforeAvatarSelectionSchema)(value)) return null
  const now = new Date()
  await collection.updateOne(
    { _id: value._id, schemaVersion: 2 },
    {
      $set: {
        'profiles.$[missing].avatarId': FamilyProfiles.defaultAvatarId,
        'profiles.$[missing].updatedAt': now,
        updatedAt: now,
      },
    },
    { arrayFilters: [{ 'missing.avatarId': { $exists: false } }] },
  )
  const migrated = await collection.findOne({ _id: value._id, schemaVersion: 2 })
  return migrated === null ? null : decodeFamily(migrated)
}

const childDocument = (
  input: Readonly<{ avatarId: ChildAvatarId; id?: string; name: ChildProfileName }>,
): Promise<ChildDocument> => {
  const now = new Date()
  return Schema.decodeUnknownPromise(ChildDocumentSchema)({
    avatarId: input.avatarId,
    createdAt: now,
    id: input.id ?? randomUUID(),
    name: input.name,
    updatedAt: now,
  })
}

const makeService = (collection: Collection<ProfileStorageDocument>): ProfileRepositoryService => {
  const findFamily: ProfileRepositoryService['findFamily'] = (googleSubject) =>
    Effect.tryPromise({
      try: async () => {
        const document = await collection.findOne({ _id: googleSubject, schemaVersion: 2 })
        if (document === null) return null
        if (Schema.is(FamilyDocumentSchema)(document)) return accountFor(document)
        const migrated = await migrateAvatarSelections(collection, document)
        if (migrated === null) throw new Error('Family profile document could not be migrated')
        return accountFor(migrated)
      },
      catch: (cause) => new ProfileRepositoryError({ cause, operation: 'find-family' }),
    })

  const findFamilyDocument = async (googleSubject: string): Promise<FamilyAccount | null> => {
    const document = await collection.findOne({ _id: googleSubject, schemaVersion: 2 })
    return document === null ? null : accountFor(await decodeFamily(document))
  }

  return {
    addChild: (googleSubject, input) =>
      Effect.tryPromise({
        try: async () => {
          const profile = await childDocument(input)
          const account = await collection.findOne({
            _id: googleSubject,
            schemaVersion: 2,
          })
          if (account === null) throw new Error('Family account does not exist')
          const decoded = await decodeFamily(account)
          const updatedAt = new Date()
          const result = await collection.updateOne(
            { _id: googleSubject, schemaVersion: 2, updatedAt: decoded.updatedAt },
            { $set: { profiles: [...decoded.profiles, profile], updatedAt } },
          )
          if (result.modifiedCount !== 1) throw new Error('Family account changed concurrently')
          return { avatarId: input.avatarId, id: profile.id, name: profile.name }
        },
        catch: (cause) => new ProfileRepositoryError({ cause, operation: 'add-child' }),
      }),
    completeInitialProfile: (googleSubject, profileId, name) =>
      Effect.tryPromise({
        try: async () => {
          const validName = await Schema.decodeUnknownPromise(ChildProfileNameSchema)(name)
          const result = await collection.updateOne(
            {
              _id: googleSubject,
              onboardingComplete: false,
              'profiles.id': profileId,
              schemaVersion: 2,
            },
            {
              $set: {
                onboardingComplete: true,
                'profiles.$.name': validName,
                'profiles.$.updatedAt': new Date(),
                updatedAt: new Date(),
              },
            },
          )
          return result.modifiedCount === 1
        },
        catch: (cause) =>
          new ProfileRepositoryError({ cause, operation: 'complete-initial-profile' }),
      }),
    ensureFamily: ({ fallbackName, googleSubject, legacyProfileId, retainLegacyProfileId }) =>
      Effect.tryPromise({
        try: async () => {
          const existing = await collection.findOne({ _id: googleSubject })
          if (existing !== null && Schema.is(FamilyDocumentSchema)(existing)) {
            return accountFor(existing)
          }
          if (existing !== null) {
            const migrated = await migrateAvatarSelections(collection, existing)
            if (migrated !== null) return accountFor(migrated)
          }
          if (existing !== null && Schema.is(LegacyProfileDocumentSchema)(existing)) {
            const migrated = await decodeFamily({
              _id: googleSubject,
              onboardingComplete: true,
              profiles: [
                await childDocument({
                  avatarId: FamilyProfiles.defaultAvatarId,
                  ...(retainLegacyProfileId ? { id: legacyProfileId } : {}),
                  name: existing.displayName,
                }),
              ],
              schemaVersion: 2,
              updatedAt: new Date(),
            })
            await collection.replaceOne({ _id: googleSubject }, migrated)
            return accountFor(migrated)
          }
          if (existing !== null) {
            throw new Error('Profile document could not be migrated')
          }
          const created = await decodeFamily({
            _id: googleSubject,
            onboardingComplete: false,
            profiles: [
              await childDocument({
                avatarId: FamilyProfiles.defaultAvatarId,
                ...(retainLegacyProfileId ? { id: legacyProfileId } : {}),
                name: fallbackName,
              }),
            ],
            schemaVersion: 2,
            updatedAt: new Date(),
          })
          try {
            await collection.insertOne(created)
            return accountFor(created)
          } catch (cause) {
            if (
              typeof cause === 'object' &&
              cause !== null &&
              'code' in cause &&
              cause.code === 11_000
            ) {
              const raced = await collection.findOne({ _id: googleSubject, schemaVersion: 2 })
              if (raced !== null) return accountFor(await decodeFamily(raced))
            }
            throw cause
          }
        },
        catch: (cause) => new ProfileRepositoryError({ cause, operation: 'ensure-family' }),
      }),
    findFamily,
    removeChild: (googleSubject, profileId) =>
      Effect.tryPromise({
        try: async () => {
          const account = await collection.findOne({ _id: googleSubject, schemaVersion: 2 })
          if (account === null) return 'not-found'
          const decoded = await decodeFamily(account)
          if (!decoded.profiles.some(({ id }) => id === profileId)) return 'not-found'
          if (decoded.profiles.length === 1) return 'last-profile'
          const result = await collection.updateOne(
            {
              _id: googleSubject,
              schemaVersion: 2,
              updatedAt: decoded.updatedAt,
            },
            {
              $set: {
                profiles: decoded.profiles.filter(({ id }) => id !== profileId),
                updatedAt: new Date(),
              },
            },
          )
          if (result.modifiedCount === 1) return 'removed'
          const current = await collection.findOne({ _id: googleSubject, schemaVersion: 2 })
          if (current === null) return 'not-found'
          const currentFamily = await decodeFamily(current)
          return currentFamily.profiles.length === 1 ? 'last-profile' : 'not-found'
        },
        catch: (cause) => new ProfileRepositoryError({ cause, operation: 'remove-child' }),
      }),
    updateChild: (googleSubject, profileId, input) =>
      Effect.tryPromise({
        try: async () => {
          const profile = await Schema.decodeUnknownPromise(ChildProfileSchema)({
            ...input,
            id: profileId,
          })
          const result = await collection.updateOne(
            { _id: googleSubject, 'profiles.id': profileId, schemaVersion: 2 },
            {
              $set: {
                'profiles.$.avatarId': profile.avatarId,
                'profiles.$.name': profile.name,
                'profiles.$.updatedAt': new Date(),
                updatedAt: new Date(),
              },
            },
          )
          if (result.matchedCount !== 1) return null
          const family = await findFamilyDocument(googleSubject)
          return family?.profiles.find(({ id }) => id === profileId) ?? profile
        },
        catch: (cause) => new ProfileRepositoryError({ cause, operation: 'update-child' }),
      }),
    updateLearningPaths: (googleSubject, profileId, learningPaths) =>
      Effect.tryPromise({
        try: async () => {
          const settings = await Schema.decodeUnknownPromise(LearningPathSettingsSchema)(
            learningPaths,
          )
          const now = new Date()
          const result = await collection.updateOne(
            { _id: googleSubject, 'profiles.id': profileId, schemaVersion: 2 },
            {
              $set: {
                'profiles.$.learningPaths': settings,
                'profiles.$.updatedAt': now,
                updatedAt: now,
              },
            },
          )
          if (result.matchedCount !== 1) return null
          const family = await findFamilyDocument(googleSubject)
          return family?.profiles.find(({ id }) => id === profileId) ?? null
        },
        catch: (cause) => new ProfileRepositoryError({ cause, operation: 'update-learning-paths' }),
      }),
  }
}

const layer = (uri: string, databaseName = 'little_tables') =>
  Layer.scoped(
    ProfileRepository,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const client = new MongoClient(uri)
          await client.connect()
          const collection = client.db(databaseName).collection<ProfileStorageDocument>('profiles')
          return { client, service: makeService(collection) }
        },
        catch: (cause) => new ProfileRepositoryError({ cause, operation: 'find-family' }),
      }),
      ({ client }) => Effect.promise(() => client.close()),
    ).pipe(Effect.map(({ service }) => service)),
  )

export const MongoProfileRepository = { layer } as const

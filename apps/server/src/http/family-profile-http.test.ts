import { HttpApp } from '@effect/platform'
import { NodeHttpPlatform } from '@effect/platform-node'
import { ChildProfileSchema } from '@little-tables/domain'
import { Layer, Schema } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InMemoryAllowedEmailRepository } from '../repositories/in-memory-allowed-email-repository.js'
import { InMemoryAttemptRepository } from '../repositories/in-memory-attempt-repository.js'
import { InMemoryGardenCollectionRepository } from '../repositories/in-memory-garden-collection-repository.js'
import { InMemoryProfileRepository } from '../repositories/in-memory-profile-repository.js'

const FamilyResponseSchema = Schema.Struct({ profiles: Schema.Array(ChildProfileSchema) })
const ProfileResponseSchema = Schema.Struct({ profile: ChildProfileSchema })
const BootstrapResponseSchema = Schema.Struct({
  completedSessions: Schema.NonNegativeInt,
  gardenBloomCount: Schema.NonNegativeInt,
  gardenCollection: Schema.Struct({
    flowerOrder: Schema.Array(Schema.NonEmptyString),
    introductionSeen: Schema.Boolean,
  }),
  profile: Schema.Struct({ id: Schema.NonEmptyString }),
})

describe('family-profile HTTP interface', () => {
  afterEach(() => {
    vi.doUnmock('../application/google-identity.js')
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('lets one Google account add, rename, and remove child profiles without removing the last child', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_ALLOWED_EMAILS', 'parent@example.com')
    vi.stubEnv('SESSION_SECRET', 'family-profile-test-secret')
    vi.doMock('../application/google-identity.js', () => ({
      verifyGoogleCredential: vi.fn(() =>
        Promise.resolve({
          displayName: 'Google Lou',
          email: 'parent@example.com',
          profileId: 'lou',
          subject: 'family-google-subject',
        }),
      ),
    }))
    vi.resetModules()
    const { httpApp } = await import('./app.js')
    const { dispose, handler } = HttpApp.toWebHandlerLayer(
      httpApp,
      Layer.mergeAll(
        NodeHttpPlatform.layer,
        InMemoryAttemptRepository.layer(),
        InMemoryAllowedEmailRepository.layer(),
        InMemoryGardenCollectionRepository.layer(),
        InMemoryProfileRepository.layer(),
      ),
    )
    const unauthenticatedSync = await handler(
      new Request('http://little-tables.local/api/v1/attempts/sync', {
        body: JSON.stringify({ attempts: [], profileId: 'unknown-child' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    expect(unauthenticatedSync.status).toBe(401)

    const signIn = await handler(
      new Request('http://little-tables.local/api/v1/auth/google', {
        body: JSON.stringify({ credential: 'signed-google-credential' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    const cookie = signIn.headers.get('set-cookie')?.split(';')[0] ?? ''
    const familyRequest = (body?: unknown, method = 'GET') =>
      handler(
        new Request('http://little-tables.local/api/v1/family/profiles', {
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          headers: {
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            cookie,
          },
          method,
        }),
      )

    const initial = await familyRequest()
    const initialBody = await Schema.decodeUnknownPromise(FamilyResponseSchema)(
      await initial.json(),
    )
    expect(initial.status).toBe(200)
    expect(initialBody.profiles).toEqual([
      expect.objectContaining({ avatarId: 'sprout', name: 'Google Lou' }),
    ])

    const added = await familyRequest({ avatarId: 'bluebell', name: 'Mia' }, 'POST')
    const addedBody = await Schema.decodeUnknownPromise(ProfileResponseSchema)(await added.json())
    expect(added.status).toBe(201)
    expect(addedBody.profile).toMatchObject({ avatarId: 'bluebell', name: 'Mia' })

    const renamed = await familyRequest(
      { avatarId: 'berry', name: 'Mimi', profileId: addedBody.profile.id },
      'PUT',
    )
    expect(renamed.status).toBe(200)
    await expect(renamed.json()).resolves.toEqual({
      profile: { avatarId: 'berry', id: addedBody.profile.id, name: 'Mimi' },
    })

    const removed = await familyRequest({ profileId: addedBody.profile.id }, 'DELETE')
    expect(removed.status).toBe(200)
    await expect(removed.json()).resolves.toEqual({ removedProfileId: addedBody.profile.id })

    const onlyProfileId = initialBody.profiles[0]?.id ?? ''
    const removeLast = await familyRequest({ profileId: onlyProfileId }, 'DELETE')
    expect(removeLast.status).toBe(409)
    await expect(removeLast.json()).resolves.toEqual({ error: 'last_profile_required' })

    await dispose()
  })

  it('accepts practice only for owned children and returns isolated child snapshots', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_ALLOWED_EMAILS', 'parent@example.com')
    vi.stubEnv('SESSION_SECRET', 'family-isolation-test-secret')
    vi.doMock('../application/google-identity.js', () => ({
      verifyGoogleCredential: vi.fn(() =>
        Promise.resolve({
          displayName: 'Google Lou',
          email: 'parent@example.com',
          profileId: 'lou',
          subject: 'isolated-family-subject',
        }),
      ),
    }))
    vi.resetModules()
    const { httpApp } = await import('./app.js')
    const { dispose, handler } = HttpApp.toWebHandlerLayer(
      httpApp,
      Layer.mergeAll(
        NodeHttpPlatform.layer,
        InMemoryAttemptRepository.layer(),
        InMemoryAllowedEmailRepository.layer(),
        InMemoryGardenCollectionRepository.layer(),
        InMemoryProfileRepository.layer(),
      ),
    )
    const signIn = await handler(
      new Request('http://little-tables.local/api/v1/auth/google', {
        body: JSON.stringify({ credential: 'signed-google-credential' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    const cookie = signIn.headers.get('set-cookie')?.split(';')[0] ?? ''
    const initialProfiles = await Schema.decodeUnknownPromise(FamilyResponseSchema)(
      await (
        await handler(
          new Request('http://little-tables.local/api/v1/family/profiles', {
            headers: { cookie },
          }),
        )
      ).json(),
    )
    const initialProfileId = initialProfiles.profiles[0]?.id ?? ''
    const add = await handler(
      new Request('http://little-tables.local/api/v1/family/profiles', {
        body: JSON.stringify({ avatarId: 'sunbeam', name: 'Mia' }),
        headers: { 'content-type': 'application/json', cookie },
        method: 'POST',
      }),
    )
    const secondProfileId = (
      await Schema.decodeUnknownPromise(ProfileResponseSchema)(await add.json())
    ).profile.id
    const attempt = {
      answerMode: 'keypad',
      answeredAt: '2026-07-25T12:00:01.000Z',
      choices: [],
      correct: true,
      eventId: 'mia-attempt-1',
      factKey: '7:8',
      latencyMs: 1_500,
      left: 7,
      operation: 'multiply',
      questionCount: 1,
      right: 8,
      selected: 56,
      sequence: 0,
      sessionId: 'mia-session-1',
    }

    const sync = await handler(
      new Request('http://little-tables.local/api/v1/attempts/sync', {
        body: JSON.stringify({ attempts: [attempt], profileId: secondProfileId }),
        headers: { 'content-type': 'application/json', cookie },
        method: 'POST',
      }),
    )
    expect(sync.status).toBe(200)

    const bootstrapFor = (profileId: string) =>
      handler(
        new Request('http://little-tables.local/api/v1/bootstrap', {
          headers: { cookie, 'x-little-tables-profile-id': profileId },
        }),
      )
    const secondFirst = await Schema.decodeUnknownPromise(BootstrapResponseSchema)(
      await (await bootstrapFor(secondProfileId)).json(),
    )
    expect(secondFirst).toMatchObject({
      completedSessions: 1,
      gardenBloomCount: 1,
      profile: { id: secondProfileId },
    })
    const initialFirst = await Schema.decodeUnknownPromise(BootstrapResponseSchema)(
      await (await bootstrapFor(initialProfileId)).json(),
    )
    expect(initialFirst).toMatchObject({
      completedSessions: 0,
      gardenBloomCount: 0,
      profile: { id: initialProfileId },
    })

    const introductionSeen = await handler(
      new Request('http://little-tables.local/api/v1/garden/introduction-seen', {
        headers: { cookie, 'x-little-tables-profile-id': secondProfileId },
        method: 'POST',
      }),
    )
    expect(introductionSeen.status).toBe(200)

    const secondReturning = await Schema.decodeUnknownPromise(BootstrapResponseSchema)(
      await (await bootstrapFor(secondProfileId)).json(),
    )
    const initialReturning = await Schema.decodeUnknownPromise(BootstrapResponseSchema)(
      await (await bootstrapFor(initialProfileId)).json(),
    )
    expect(secondReturning.gardenCollection).toMatchObject({
      flowerOrder: secondFirst.gardenCollection.flowerOrder,
      introductionSeen: true,
    })
    expect(secondReturning.gardenBloomCount).toBe(1)
    expect(initialReturning.gardenCollection).toMatchObject({
      flowerOrder: initialFirst.gardenCollection.flowerOrder,
      introductionSeen: false,
    })
    expect(initialReturning.gardenBloomCount).toBe(0)

    const forbidden = await handler(
      new Request('http://little-tables.local/api/v1/attempts/sync', {
        body: JSON.stringify({ attempts: [], profileId: 'another-familys-child' }),
        headers: { 'content-type': 'application/json', cookie },
        method: 'POST',
      }),
    )
    expect(forbidden.status).toBe(403)
    await expect(forbidden.json()).resolves.toEqual({ error: 'profile_forbidden' })

    await dispose()
  })

  it('keeps garden and practice state isolated across Google accounts and restores it after sign-in', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_ALLOWED_EMAILS', 'parent-a@example.com,parent-b@example.com')
    vi.stubEnv('SESSION_SECRET', 'account-isolation-test-secret')
    vi.doMock('../application/google-identity.js', () => ({
      verifyGoogleCredential: vi.fn(({ credential }: Readonly<{ credential: string }>) =>
        Promise.resolve(
          credential === 'account-a'
            ? {
                displayName: 'Parent A',
                email: 'parent-a@example.com',
                profileId: 'lou',
                subject: 'google-account-a',
              }
            : {
                displayName: 'Parent B',
                email: 'parent-b@example.com',
                profileId: 'lou',
                subject: 'google-account-b',
              },
        ),
      ),
    }))
    vi.resetModules()
    const { httpApp } = await import('./app.js')
    const { dispose, handler } = HttpApp.toWebHandlerLayer(
      httpApp,
      Layer.mergeAll(
        NodeHttpPlatform.layer,
        InMemoryAttemptRepository.layer(),
        InMemoryAllowedEmailRepository.layer(),
        InMemoryGardenCollectionRepository.layer(),
        InMemoryProfileRepository.layer(),
      ),
    )
    const signIn = async (credential: string) => {
      const response = await handler(
        new Request('http://little-tables.local/api/v1/auth/google', {
          body: JSON.stringify({ credential }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }),
      )
      expect(response.status).toBe(200)
      return response.headers.get('set-cookie')?.split(';')[0] ?? ''
    }
    const profilesFor = async (cookie: string) =>
      Schema.decodeUnknownPromise(FamilyResponseSchema)(
        await (
          await handler(
            new Request('http://little-tables.local/api/v1/family/profiles', {
              headers: { cookie },
            }),
          )
        ).json(),
      )
    const bootstrapFor = async (cookie: string, profileId: string) =>
      Schema.decodeUnknownPromise(BootstrapResponseSchema)(
        await (
          await handler(
            new Request('http://little-tables.local/api/v1/bootstrap', {
              headers: { cookie, 'x-little-tables-profile-id': profileId },
            }),
          )
        ).json(),
      )

    const accountACookie = await signIn('account-a')
    const accountBCookie = await signIn('account-b')
    const accountAProfileId = (await profilesFor(accountACookie)).profiles[0]?.id ?? ''
    const accountBProfileId = (await profilesFor(accountBCookie)).profiles[0]?.id ?? ''
    expect(accountAProfileId).not.toBe(accountBProfileId)

    const sync = await handler(
      new Request('http://little-tables.local/api/v1/attempts/sync', {
        body: JSON.stringify({
          attempts: [
            {
              answerMode: 'keypad',
              answeredAt: '2026-07-25T12:00:01.000Z',
              choices: [],
              correct: true,
              eventId: 'account-a-attempt-1',
              factKey: '7:8',
              latencyMs: 1_500,
              left: 7,
              operation: 'multiply',
              questionCount: 1,
              right: 8,
              selected: 56,
              sequence: 0,
              sessionId: 'account-a-session-1',
            },
          ],
          profileId: accountAProfileId,
        }),
        headers: { 'content-type': 'application/json', cookie: accountACookie },
        method: 'POST',
      }),
    )
    expect(sync.status).toBe(200)
    const introductionSeen = await handler(
      new Request('http://little-tables.local/api/v1/garden/introduction-seen', {
        headers: {
          cookie: accountACookie,
          'x-little-tables-profile-id': accountAProfileId,
        },
        method: 'POST',
      }),
    )
    expect(introductionSeen.status).toBe(200)

    const accountAFirst = await bootstrapFor(accountACookie, accountAProfileId)
    const accountBFirst = await bootstrapFor(accountBCookie, accountBProfileId)
    expect(accountAFirst).toMatchObject({
      completedSessions: 1,
      gardenBloomCount: 1,
      gardenCollection: { introductionSeen: true },
    })
    expect(accountBFirst).toMatchObject({
      completedSessions: 0,
      gardenBloomCount: 0,
      gardenCollection: { introductionSeen: false },
    })

    const forbidden = await handler(
      new Request('http://little-tables.local/api/v1/bootstrap', {
        headers: {
          cookie: accountBCookie,
          'x-little-tables-profile-id': accountAProfileId,
        },
      }),
    )
    expect(forbidden.status).toBe(403)
    await expect(forbidden.json()).resolves.toEqual({ error: 'profile_forbidden' })

    const returningAccountACookie = await signIn('account-a')
    const accountAReturning = await bootstrapFor(returningAccountACookie, accountAProfileId)
    expect(accountAReturning.gardenCollection.flowerOrder).toEqual(
      accountAFirst.gardenCollection.flowerOrder,
    )
    expect(accountAReturning).toMatchObject({
      completedSessions: 1,
      gardenBloomCount: 1,
      gardenCollection: { introductionSeen: true },
    })

    await dispose()
  })
})

import { HttpApp } from '@effect/platform'
import { NodeHttpPlatform } from '@effect/platform-node'
import { Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InMemoryAllowedEmailRepository } from '../repositories/in-memory-allowed-email-repository.js'
import { InMemoryAttemptRepository } from '../repositories/in-memory-attempt-repository.js'
import { InMemoryGardenCollectionRepository } from '../repositories/in-memory-garden-collection-repository.js'
import { InMemoryProfileRepository } from '../repositories/in-memory-profile-repository.js'

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
    const initialBody = (await initial.json()) as {
      profiles: ReadonlyArray<{ avatarId: string; id: string; name: string }>
    }
    expect(initial.status).toBe(200)
    expect(initialBody.profiles).toEqual([
      expect.objectContaining({ avatarId: 'sprout', name: 'Google Lou' }),
    ])

    const added = await familyRequest({ avatarId: 'bluebell', name: 'Mia' }, 'POST')
    const addedBody = (await added.json()) as {
      profile: { avatarId: string; id: string; name: string }
    }
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
    const initialProfiles = (await (
      await handler(
        new Request('http://little-tables.local/api/v1/family/profiles', {
          headers: { cookie },
        }),
      )
    ).json()) as { profiles: ReadonlyArray<{ id: string }> }
    const initialProfileId = initialProfiles.profiles[0]?.id ?? ''
    const add = await handler(
      new Request('http://little-tables.local/api/v1/family/profiles', {
        body: JSON.stringify({ avatarId: 'sunbeam', name: 'Mia' }),
        headers: { 'content-type': 'application/json', cookie },
        method: 'POST',
      }),
    )
    const secondProfileId = ((await add.json()) as { profile: { id: string } }).profile.id
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
    await expect((await bootstrapFor(secondProfileId)).json()).resolves.toMatchObject({
      completedSessions: 1,
      profile: { id: secondProfileId },
    })
    await expect((await bootstrapFor(initialProfileId)).json()).resolves.toMatchObject({
      completedSessions: 0,
      profile: { id: initialProfileId },
    })

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
})

import { HttpApp } from '@effect/platform'
import { NodeHttpPlatform } from '@effect/platform-node'
import { Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InMemoryAllowedEmailRepository } from '../repositories/in-memory-allowed-email-repository.js'
import { InMemoryAttemptRepository } from '../repositories/in-memory-attempt-repository.js'
import { InMemoryGardenCollectionRepository } from '../repositories/in-memory-garden-collection-repository.js'
import { InMemoryProfileRepository } from '../repositories/in-memory-profile-repository.js'

describe('preferred-name HTTP interface', () => {
  afterEach(() => {
    vi.doUnmock('../application/google-identity.js')
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('starts with the Google name, saves the first choice, and reuses it at the next login', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_ALLOWED_EMAILS', 'learner@example.com')
    vi.stubEnv('SESSION_SECRET', 'preferred-name-test-secret')
    vi.doMock('../application/google-identity.js', () => ({
      verifyGoogleCredential: vi.fn(() =>
        Promise.resolve({
          displayName: 'google lou',
          email: 'learner@example.com',
          profileId: 'lou',
          subject: 'google-subject',
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

    const signIn = () =>
      handler(
        new Request('http://little-tables.local/api/v1/auth/google', {
          body: JSON.stringify({ credential: 'signed-google-credential' }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }),
      )
    const statusFor = (cookie: string) =>
      handler(
        new Request('http://little-tables.local/api/v1/auth/status', {
          headers: { cookie },
        }),
      )

    const firstSignIn = await signIn()
    const firstCookie = firstSignIn.headers.get('set-cookie')?.split(';')[0]
    expect(firstCookie).toBeDefined()
    const firstStatus = await statusFor(firstCookie ?? '')
    await expect(firstStatus.json()).resolves.toMatchObject({
      displayName: 'google lou',
      nameChoiceRequired: true,
    })

    for (const displayName of ['   ', 'x'.repeat(41)]) {
      const invalidSave = await handler(
        new Request('http://little-tables.local/api/v1/profile/name', {
          body: JSON.stringify({ displayName }),
          headers: { 'content-type': 'application/json', cookie: firstCookie ?? '' },
          method: 'PUT',
        }),
      )
      expect(invalidSave.status).toBe(400)
      await expect(invalidSave.json()).resolves.toEqual({ error: 'invalid_display_name' })
    }

    const save = await handler(
      new Request('http://little-tables.local/api/v1/profile/name', {
        body: JSON.stringify({ displayName: '  Lulu  ' }),
        headers: { 'content-type': 'application/json', cookie: firstCookie ?? '' },
        method: 'PUT',
      }),
    )
    const chosenCookie = save.headers.get('set-cookie')?.split(';')[0]
    expect(save.status).toBe(200)
    await expect(save.json()).resolves.toEqual({ displayName: 'Lulu' })
    expect(chosenCookie).toBeDefined()
    const chosenStatus = await statusFor(chosenCookie ?? '')
    await expect(chosenStatus.json()).resolves.toMatchObject({
      displayName: 'Lulu',
      nameChoiceRequired: false,
    })
    const repeatedSave = await handler(
      new Request('http://little-tables.local/api/v1/profile/name', {
        body: JSON.stringify({ displayName: 'Another name' }),
        headers: { 'content-type': 'application/json', cookie: firstCookie ?? '' },
        method: 'PUT',
      }),
    )
    expect(repeatedSave.status).toBe(409)
    await expect(repeatedSave.json()).resolves.toEqual({ error: 'name_already_chosen' })

    const nextSignIn = await signIn()
    const nextCookie = nextSignIn.headers.get('set-cookie')?.split(';')[0]
    expect(nextCookie).toBeDefined()
    const nextStatus = await statusFor(nextCookie ?? '')
    await expect(nextStatus.json()).resolves.toMatchObject({
      displayName: 'Lulu',
      nameChoiceRequired: false,
    })
    await dispose()
  })
})

import { HttpApp } from '@effect/platform'
import { NodeHttpPlatform } from '@effect/platform-node'
import { Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Identity } from '../application/identity.js'
import { InMemoryAllowedEmailRepository } from '../repositories/in-memory-allowed-email-repository.js'
import { InMemoryAttemptRepository } from '../repositories/in-memory-attempt-repository.js'

const secret = 'admin-http-test-session-secret'

const sessionFor = (email: string, sessionVersion = 0) =>
  Identity.issue({
    authMethod: 'google',
    displayName: 'tester',
    email,
    googleSubject: `subject-for-${email}`,
    now: new Date(),
    profileId: 'lou',
    secret,
    sessionVersion,
  })

describe('owner-only allowed email HTTP interface', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('allows the signed-in owner and rejects another signed-in user', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_ALLOWED_EMAILS', 'learner@example.com')
    vi.stubEnv('SESSION_SECRET', secret)
    vi.resetModules()
    const { httpApp } = await import('./app.js')
    const { dispose, handler } = HttpApp.toWebHandlerLayer(
      httpApp,
      Layer.merge(
        NodeHttpPlatform.layer,
        Layer.merge(InMemoryAttemptRepository.layer(), InMemoryAllowedEmailRepository.layer()),
      ),
    )

    const ownerResponse = await handler(
      new Request('http://little-tables.local/api/v1/admin/allowed-emails', {
        body: JSON.stringify({ email: ' New.User@Example.com ' }),
        headers: {
          'content-type': 'application/json',
          cookie: `little-tables-session=${sessionFor('boomslang.a@gmail.com')}`,
        },
        method: 'POST',
      }),
    )
    const nonOwnerResponse = await handler(
      new Request('http://little-tables.local/api/v1/admin/allowed-emails', {
        body: JSON.stringify({ email: 'friend@example.com' }),
        headers: {
          'content-type': 'application/json',
          cookie: `little-tables-session=${sessionFor('learner@example.com')}`,
        },
        method: 'POST',
      }),
    )
    await dispose()

    expect(ownerResponse.status).toBe(201)
    await expect(ownerResponse.json()).resolves.toEqual({
      created: true,
      email: 'new.user@example.com',
    })
    expect(nonOwnerResponse.status).toBe(403)
  })

  it('revokes an allowed address and rejects its existing session', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_ALLOWED_EMAILS', 'configured@example.com')
    vi.stubEnv('SESSION_SECRET', secret)
    vi.resetModules()
    const { httpApp } = await import('./app.js')
    const { dispose, handler } = HttpApp.toWebHandlerLayer(
      httpApp,
      Layer.merge(
        NodeHttpPlatform.layer,
        Layer.merge(InMemoryAttemptRepository.layer(), InMemoryAllowedEmailRepository.layer()),
      ),
    )
    const learnerCookie = `little-tables-session=${sessionFor('configured@example.com')}`
    const ownerCookie = `little-tables-session=${sessionFor('boomslang.a@gmail.com')}`

    const beforeRemoval = await handler(
      new Request('http://little-tables.local/api/v1/auth/status', {
        headers: { cookie: learnerCookie },
      }),
    )
    const removed = await handler(
      new Request('http://little-tables.local/api/v1/admin/allowed-emails', {
        body: JSON.stringify({ email: 'configured@example.com' }),
        headers: { 'content-type': 'application/json', cookie: ownerCookie },
        method: 'DELETE',
      }),
    )
    const afterRemoval = await handler(
      new Request('http://little-tables.local/api/v1/auth/status', {
        headers: { cookie: learnerCookie },
      }),
    )
    const refresh = await handler(
      new Request('http://little-tables.local/api/v1/session/refresh', {
        headers: { cookie: learnerCookie },
        method: 'POST',
      }),
    )
    const restored = await handler(
      new Request('http://little-tables.local/api/v1/admin/allowed-emails', {
        body: JSON.stringify({ email: 'configured@example.com' }),
        headers: { 'content-type': 'application/json', cookie: ownerCookie },
        method: 'POST',
      }),
    )
    const oldSessionAfterRestore = await handler(
      new Request('http://little-tables.local/api/v1/auth/status', {
        headers: { cookie: learnerCookie },
      }),
    )
    const newSessionAfterRestore = await handler(
      new Request('http://little-tables.local/api/v1/auth/status', {
        headers: {
          cookie: `little-tables-session=${sessionFor('configured@example.com', 1)}`,
        },
      }),
    )
    await dispose()

    await expect(beforeRemoval.json()).resolves.toMatchObject({ authenticated: true })
    expect(removed.status).toBe(200)
    await expect(removed.json()).resolves.toEqual({
      email: 'configured@example.com',
      removed: true,
    })
    await expect(afterRemoval.json()).resolves.toMatchObject({ authenticated: false })
    expect(refresh.status).toBe(401)
    expect(restored.status).toBe(201)
    await expect(oldSessionAfterRestore.json()).resolves.toMatchObject({ authenticated: false })
    await expect(newSessionAfterRestore.json()).resolves.toMatchObject({ authenticated: true })
  })
})

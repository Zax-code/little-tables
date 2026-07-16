import { describe, expect, it, vi } from 'vitest'

import {
  fetchAuthStatus,
  PreferredNameSaveError,
  savePreferredName,
  signInWithGoogle,
} from './auth-client.js'

describe('auth client', () => {
  it('decodes the server authentication status', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          authenticated: false,
          authenticationRequired: true,
          displayName: null,
          googleClientId: 'client.apps.googleusercontent.com',
          isAdmin: false,
          nameChoiceRequired: true,
          sessionExpiresAt: null,
        }),
      ),
    )

    await expect(fetchAuthStatus(fetcher)).resolves.toEqual({
      authenticated: false,
      authenticationRequired: true,
      displayName: null,
      googleClientId: 'client.apps.googleusercontent.com',
      isAdmin: false,
      nameChoiceRequired: true,
      sessionExpiresAt: null,
    })
  })

  it('posts Google credentials without putting them in URLs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))

    await signInWithGoogle('signed-id-token', fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/auth/google',
      expect.objectContaining({
        body: JSON.stringify({ credential: 'signed-id-token' }),
        method: 'POST',
      }),
    )
  })

  it('saves the trimmed preferred name through the profile interface', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ displayName: 'Lulu' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    )

    await expect(savePreferredName('  Lulu  ', fetcher)).resolves.toBe('Lulu')

    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/profile/name',
      expect.objectContaining({
        body: JSON.stringify({ displayName: '  Lulu  ' }),
        method: 'PUT',
      }),
    )
  })

  it('reports when the first-login name was already chosen', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 409 }))

    await expect(savePreferredName('Lulu', fetcher)).rejects.toEqual(
      new PreferredNameSaveError({ reason: 'already-chosen' }),
    )
  })
})

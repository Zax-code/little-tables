import { describe, expect, it, vi } from 'vitest'

import { fetchAuthStatus, signInWithGoogle } from './auth-client.js'

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
})

import { describe, expect, it, vi } from 'vitest'

import { claimInvite, fetchAuthStatus, signInWithGoogle } from './auth-client.js'

describe('auth client', () => {
  it('decodes the server authentication status', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          authenticated: false,
          authenticationRequired: true,
          displayName: null,
          googleClientId: 'client.apps.googleusercontent.com',
        }),
      ),
    )

    await expect(fetchAuthStatus(fetcher)).resolves.toEqual({
      authenticated: false,
      authenticationRequired: true,
      displayName: null,
      googleClientId: 'client.apps.googleusercontent.com',
    })
  })

  it('posts invite and Google credentials without putting them in URLs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))

    await claimInvite('private-token', fetcher)
    await signInWithGoogle('signed-id-token', fetcher)

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      '/api/v1/invites/claim',
      expect.objectContaining({ body: JSON.stringify({ token: 'private-token' }), method: 'POST' }),
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/google',
      expect.objectContaining({
        body: JSON.stringify({ credential: 'signed-id-token' }),
        method: 'POST',
      }),
    )
  })
})

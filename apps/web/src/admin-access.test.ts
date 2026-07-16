import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { authStatusQueryKey, type AuthStatus } from './auth-client.js'
import { loadAdministratorStatus } from './admin-access.js'

const administratorStatus: AuthStatus = {
  authenticated: true,
  authenticationRequired: true,
  displayName: 'Zax',
  googleClientId: 'client.apps.googleusercontent.com',
  isAdmin: true,
  sessionExpiresAt: Date.now() + 60_000,
}

describe('administrator access', () => {
  it('reuses a fresh authorization result already held by the app', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(authStatusQueryKey, administratorStatus)
    const fetcher = vi.fn<typeof fetch>()

    await expect(loadAdministratorStatus(queryClient, fetcher)).resolves.toEqual(
      administratorStatus,
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('refreshes authorization when the cached result is stale', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(authStatusQueryKey, administratorStatus, {
      updatedAt: Date.now() - 31_000,
    })
    const refreshedStatus = { ...administratorStatus, displayName: 'Fresh Zax' }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(refreshedStatus), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    )

    await expect(loadAdministratorStatus(queryClient, fetcher)).resolves.toEqual(refreshedStatus)
    expect(fetcher).toHaveBeenCalledOnce()
  })
})

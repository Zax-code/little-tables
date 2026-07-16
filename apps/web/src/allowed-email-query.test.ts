import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { allowedEmailsQueryKey } from './allowed-email-client.js'
import {
  prefetchAllowedEmails,
  removeAllowedEmailFromCache,
  updateAllowedEmailsCache,
} from './allowed-email-query.js'

describe('allowed email query', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('makes a newly allowed address visible without another server request', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(allowedEmailsQueryKey, ['boomslang.a@gmail.com', 'zh.wener@gmail.com'])

    updateAllowedEmailsCache(queryClient, {
      created: true,
      email: 'new.user@example.com',
    })

    expect(queryClient.getQueryData(allowedEmailsQueryKey)).toEqual([
      'boomslang.a@gmail.com',
      'new.user@example.com',
      'zh.wener@gmail.com',
    ])
  })

  it('does not strand the administrator screen when allowlist preload fails', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    )

    await expect(prefetchAllowedEmails(queryClient)).resolves.toBeUndefined()
  })

  it('hides a removed address without another server request', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(allowedEmailsQueryKey, [
      'boomslang.a@gmail.com',
      'new.user@example.com',
    ])

    removeAllowedEmailFromCache(queryClient, {
      email: 'new.user@example.com',
      removed: true,
    })

    expect(queryClient.getQueryData(allowedEmailsQueryKey)).toEqual(['boomslang.a@gmail.com'])
  })
})

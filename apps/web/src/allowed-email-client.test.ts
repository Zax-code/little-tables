import { describe, expect, it, vi } from 'vitest'

import { addAllowedEmail, fetchAllowedEmails } from './allowed-email-client.js'

describe('allowed email client', () => {
  it('lists and adds addresses through the owner management endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ emails: ['boomslang.a@gmail.com'] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ created: true, email: 'new.user@example.com' }), {
          status: 201,
        }),
      )

    await expect(fetchAllowedEmails(fetcher)).resolves.toEqual(['boomslang.a@gmail.com'])
    await expect(addAllowedEmail('new.user@example.com', fetcher)).resolves.toEqual({
      created: true,
      email: 'new.user@example.com',
    })
    expect(fetcher).toHaveBeenLastCalledWith(
      '/api/v1/admin/allowed-emails',
      expect.objectContaining({
        body: JSON.stringify({ email: 'new.user@example.com' }),
        method: 'POST',
      }),
    )
  })
})

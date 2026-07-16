import { describe, expect, it, vi } from 'vitest'

import { addAllowedEmail, fetchAllowedEmails, removeAllowedEmail } from './allowed-email-client.js'

describe('allowed email client', () => {
  it('lists, adds, and removes addresses through the owner management endpoints', async () => {
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ email: 'new.user@example.com', removed: true }), {
          status: 200,
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
    await expect(removeAllowedEmail('new.user@example.com', fetcher)).resolves.toEqual({
      email: 'new.user@example.com',
      removed: true,
    })
    expect(fetcher).toHaveBeenLastCalledWith(
      '/api/v1/admin/allowed-emails',
      expect.objectContaining({
        body: JSON.stringify({ email: 'new.user@example.com' }),
        method: 'DELETE',
      }),
    )
  })

  it('reports invalid addresses as a tagged expected failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 400 }))

    await expect(addAllowedEmail('not an email', fetcher)).rejects.toMatchObject({
      _tag: 'AllowedEmailClientError',
      reason: 'invalid_email',
    })
  })
})

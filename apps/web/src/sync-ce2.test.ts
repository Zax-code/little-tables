import { describe, expect, it, vi } from 'vitest'

import { flushPendingCe2Attempts } from './sync-ce2.js'
import { SyncAuthenticationError } from './sync.js'

const preference = {
  enabledModules: ['fractions'] as const,
  eventId: 'preference-1',
  lastDailyFamily: 'fractions' as const,
  schemaVersion: 'ce2-preference-update/v1' as const,
  updatedAt: new Date('2026-10-05T12:00:00Z'),
}

describe('CE2 synchronization', () => {
  it('sends profile-owned preference changes and acknowledges only submitted IDs', async () => {
    const store = {
      acknowledgeCe2: vi.fn().mockResolvedValue(undefined),
      pendingCe2Batch: vi.fn().mockResolvedValue({ attempts: [], preferenceUpdates: [preference] }),
    }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        accepted: ['preference-1', 'other-profile'],
        duplicates: [],
        rejected: [],
      }),
    )
    const result = await flushPendingCe2Attempts({ fetcher, profileId: 'child-one', store })
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v2/attempts/sync',
      expect.objectContaining({
        body: JSON.stringify({
          attempts: [],
          preferenceUpdates: [preference],
          profileId: 'child-one',
        }),
      }),
    )
    expect(store.acknowledgeCe2).toHaveBeenCalledWith(['preference-1'])
    expect(result).toEqual({ acknowledged: 1, rejected: 0, status: 'synced' })
  })

  it('keeps pending work if an older server cannot understand the new format', async () => {
    const store = {
      acknowledgeCe2: vi.fn().mockResolvedValue(undefined),
      pendingCe2Batch: vi.fn().mockResolvedValue({ attempts: [], preferenceUpdates: [preference] }),
    }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }))
    await expect(
      flushPendingCe2Attempts({ fetcher, profileId: 'child-one', store }),
    ).rejects.toThrow('404')
    expect(store.acknowledgeCe2).not.toHaveBeenCalled()
  })

  it('preserves the outbox and requests fresh authentication after an expired session', async () => {
    const store = {
      acknowledgeCe2: vi.fn().mockResolvedValue(undefined),
      pendingCe2Batch: vi.fn().mockResolvedValue({ attempts: [], preferenceUpdates: [preference] }),
    }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }))
    await expect(
      flushPendingCe2Attempts({ fetcher, profileId: 'child-one', store }),
    ).rejects.toBeInstanceOf(SyncAuthenticationError)
    expect(store.acknowledgeCe2).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'

import { flushPendingAttemptsForProfiles } from './family-profile-sync.js'

describe('family profile sync', () => {
  it('flushes pending attempts for every family member, not only the active member', async () => {
    const flushProfile = vi.fn<(profileId: string) => Promise<void>>().mockResolvedValue()

    await flushPendingAttemptsForProfiles(
      [
        { avatarId: 'sprout', id: 'child-one', name: 'Lou' },
        { avatarId: 'bluebell', id: 'child-two', name: 'Mia' },
      ],
      flushProfile,
    )

    expect(flushProfile.mock.calls).toEqual([['child-one'], ['child-two']])
  })
})

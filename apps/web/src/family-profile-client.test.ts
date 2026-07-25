import { describe, expect, it, vi } from 'vitest'

import {
  createChildProfile,
  fetchFamilyProfiles,
  removeChildProfile,
  updateChildProfile,
} from './family-profile-client.js'

describe('family profile client', () => {
  it('loads server profiles and sends each family-management mutation', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profiles: [{ avatarId: 'sprout', id: 'child-1', name: 'Lou' }],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile: { avatarId: 'malo-bear', id: 'child-2', name: 'Mia' },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile: { avatarId: 'mina-cat', id: 'child-2', name: 'Mimi' },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ removedProfileId: 'child-2' })))

    await expect(fetchFamilyProfiles(fetcher)).resolves.toEqual([
      { avatarId: 'sprout', id: 'child-1', name: 'Lou' },
    ])
    await createChildProfile({ avatarId: 'malo-bear', name: 'Mia' }, fetcher)
    await updateChildProfile('child-2', { avatarId: 'mina-cat', name: 'Mimi' }, fetcher)
    await removeChildProfile('child-2', fetcher)

    expect(fetcher.mock.calls.map((call) => [call[0], call[1]?.method])).toEqual([
      ['/api/v1/family/profiles', undefined],
      ['/api/v1/family/profiles', 'POST'],
      ['/api/v1/family/profiles', 'PUT'],
      ['/api/v1/family/profiles', 'DELETE'],
    ])
    const createBody = fetcher.mock.calls[1]?.[1]?.body
    const updateBody = fetcher.mock.calls[2]?.[1]?.body
    if (typeof createBody !== 'string' || typeof updateBody !== 'string') {
      throw new Error('Expected family profile mutation bodies to be JSON strings')
    }
    expect(JSON.parse(createBody) as unknown).toEqual({
      avatarId: 'malo-bear',
      name: 'Mia',
    })
    expect(JSON.parse(updateBody) as unknown).toEqual({
      avatarId: 'mina-cat',
      name: 'Mimi',
      profileId: 'child-2',
    })
  })
})

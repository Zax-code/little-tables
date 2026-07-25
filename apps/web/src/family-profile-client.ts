import {
  ChildProfileSchema,
  type ChildProfile,
  type SelectableChildAvatarId,
} from '@little-tables/domain'
import { Data, Schema } from 'effect'

const FamilyProfilesResponseSchema = Schema.Struct({
  profiles: Schema.Array(ChildProfileSchema),
})
const ChildProfileResponseSchema = Schema.Struct({ profile: ChildProfileSchema })
const RemoveChildProfileResponseSchema = Schema.Struct({
  removedProfileId: Schema.NonEmptyString,
})

export const familyProfilesQueryKey = ['family-profiles'] as const

export class FamilyProfileClientError extends Data.TaggedError('FamilyProfileClientError')<{
  reason: 'failed' | 'last-profile' | 'not-found'
}> {}

const mutation = async (
  method: 'DELETE' | 'POST' | 'PUT',
  body: unknown,
  fetcher: typeof fetch,
): Promise<Response> => {
  const response = await fetcher('/api/v1/family/profiles', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  })
  if (!response.ok) {
    throw new FamilyProfileClientError({
      reason:
        response.status === 409 ? 'last-profile' : response.status === 404 ? 'not-found' : 'failed',
    })
  }
  return response
}

export async function fetchFamilyProfiles(
  fetcher: typeof fetch = fetch,
): Promise<ReadonlyArray<ChildProfile>> {
  const response = await fetcher('/api/v1/family/profiles')
  if (!response.ok) throw new FamilyProfileClientError({ reason: 'failed' })
  const decoded = await Schema.decodeUnknownPromise(FamilyProfilesResponseSchema)(
    await response.json(),
  )
  return decoded.profiles
}

export async function createChildProfile(
  input: Readonly<{ avatarId: SelectableChildAvatarId; name: string }>,
  fetcher: typeof fetch = fetch,
): Promise<ChildProfile> {
  const response = await mutation('POST', input, fetcher)
  const decoded = await Schema.decodeUnknownPromise(ChildProfileResponseSchema)(
    await response.json(),
  )
  return decoded.profile
}

export async function updateChildProfile(
  profileId: string,
  input: Readonly<{ avatarId: SelectableChildAvatarId; name: string }>,
  fetcher: typeof fetch = fetch,
): Promise<ChildProfile> {
  const response = await mutation('PUT', { ...input, profileId }, fetcher)
  const decoded = await Schema.decodeUnknownPromise(ChildProfileResponseSchema)(
    await response.json(),
  )
  return decoded.profile
}

export async function removeChildProfile(
  profileId: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await mutation('DELETE', { profileId }, fetcher)
  const decoded = await Schema.decodeUnknownPromise(RemoveChildProfileResponseSchema)(
    await response.json(),
  )
  return decoded.removedProfileId
}

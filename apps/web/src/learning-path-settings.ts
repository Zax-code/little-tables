import {
  ChildProfileSchema,
  defaultLearningPathSettings,
  type ChildProfile,
  type LearningPathSettings,
} from '@little-tables/domain'
import { Schema } from 'effect'

import { FamilyProfileClientError } from './family-profile-client.js'

/** The profile's path settings; a profile nobody configured follows the automatic rules. */
export const learningPathsFor = (profile: ChildProfile): LearningPathSettings =>
  profile.learningPaths ?? defaultLearningPathSettings

const ProfileResponseSchema = Schema.Struct({ profile: ChildProfileSchema })

export async function saveLearningPaths(
  profileId: string,
  learningPaths: LearningPathSettings,
  fetcher: typeof fetch = fetch,
): Promise<ChildProfile> {
  const response = await fetcher('/api/v1/family/profiles/learning-paths', {
    body: JSON.stringify({ learningPaths, profileId }),
    headers: { 'content-type': 'application/json' },
    method: 'PUT',
  })
  if (!response.ok) {
    throw new FamilyProfileClientError({ reason: response.status === 404 ? 'not-found' : 'failed' })
  }
  const decoded = await Schema.decodeUnknownPromise(ProfileResponseSchema)(await response.json())
  return decoded.profile
}

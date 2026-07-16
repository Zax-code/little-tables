import { Effect, Layer } from 'effect'

import { ProfileRepository, type ProfileRepositoryService } from './profile-repository.js'

const layer = () => {
  const preferredNames = new Map<string, string>()
  const service: ProfileRepositoryService = {
    findPreferredName: (googleSubject) =>
      Effect.sync(() => preferredNames.get(googleSubject) ?? null),
    savePreferredName: (googleSubject, displayName) =>
      Effect.sync(() => {
        if (preferredNames.has(googleSubject)) return false
        preferredNames.set(googleSubject, displayName)
        return true
      }),
  }
  return Layer.succeed(ProfileRepository, service)
}

export const InMemoryProfileRepository = { layer } as const

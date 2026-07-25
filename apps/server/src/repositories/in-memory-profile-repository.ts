import { FamilyProfiles, type ChildProfile } from '@little-tables/domain'
import { Effect, Layer } from 'effect'

import {
  ProfileRepository,
  ProfileRepositoryError,
  type ProfileRepositoryService,
} from './profile-repository.js'

const layer = () => {
  const accounts = new Map<
    string,
    Readonly<{
      googleSubject: string
      onboardingComplete: boolean
      profiles: ReadonlyArray<ChildProfile>
    }>
  >()

  const service: ProfileRepositoryService = {
    addChild: (googleSubject, input) =>
      Effect.try({
        try: () => {
          const account = accounts.get(googleSubject)
          if (account === undefined) throw new Error('Family account does not exist')
          const profile = { ...input, id: crypto.randomUUID() }
          accounts.set(googleSubject, {
            ...account,
            profiles: [...account.profiles, profile],
          })
          return profile
        },
        catch: (cause) => new ProfileRepositoryError({ cause, operation: 'add-child' }),
      }),
    completeInitialProfile: (googleSubject, profileId, name) =>
      Effect.sync(() => {
        const account = accounts.get(googleSubject)
        if (account === undefined || account.onboardingComplete) return false
        const profile = account.profiles.find(({ id }) => id === profileId)
        if (profile === undefined) return false
        accounts.set(googleSubject, {
          ...account,
          onboardingComplete: true,
          profiles: account.profiles.map((candidate) =>
            candidate.id === profileId ? { ...candidate, name } : candidate,
          ),
        })
        return true
      }),
    ensureFamily: ({ fallbackName, googleSubject }) =>
      Effect.sync(() => {
        const existing = accounts.get(googleSubject)
        if (existing !== undefined) return existing
        const account = {
          googleSubject,
          onboardingComplete: false,
          profiles: [
            {
              avatarId: FamilyProfiles.defaultAvatarId,
              id: crypto.randomUUID(),
              name: fallbackName,
            },
          ],
        } as const
        accounts.set(googleSubject, account)
        return account
      }),
    findFamily: (googleSubject) => Effect.sync(() => accounts.get(googleSubject) ?? null),
    removeChild: (googleSubject, profileId) =>
      Effect.sync(() => {
        const account = accounts.get(googleSubject)
        if (!account?.profiles.some(({ id }) => id === profileId)) {
          return 'not-found' as const
        }
        if (account.profiles.length === 1) return 'last-profile' as const
        accounts.set(googleSubject, {
          ...account,
          profiles: account.profiles.filter(({ id }) => id !== profileId),
        })
        return 'removed' as const
      }),
    updateChild: (googleSubject, profileId, input) =>
      Effect.sync(() => {
        const account = accounts.get(googleSubject)
        const existing = account?.profiles.find(({ id }) => id === profileId)
        if (account === undefined || existing === undefined) return null
        const profile = { ...existing, ...input }
        accounts.set(googleSubject, {
          ...account,
          profiles: account.profiles.map((candidate) =>
            candidate.id === profileId ? profile : candidate,
          ),
        })
        return profile
      }),
  }
  return Layer.succeed(ProfileRepository, service)
}

export const InMemoryProfileRepository = { layer } as const

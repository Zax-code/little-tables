import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { InMemoryProfileRepository } from './in-memory-profile-repository.js'
import { ProfileRepository } from './profile-repository.js'

describe('ProfileRepository', () => {
  it('retains an explicitly assigned legacy profile ID when creating an owner family', async () => {
    const account = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* ProfileRepository
        return yield* repository.ensureFamily({
          fallbackName: 'Lou',
          googleSubject: 'owner-google-subject',
          legacyProfileId: 'lou',
          retainLegacyProfileId: true,
        })
      }).pipe(Effect.provide(InMemoryProfileRepository.layer())),
    )

    expect(account).toMatchObject({
      onboardingComplete: false,
      profiles: [{ id: 'lou', name: 'Lou' }],
    })
  })
})

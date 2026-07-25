import { describe, expect, it } from 'vitest'

import { administratorEmail } from './allowed-email-access.js'
import { LegacyProfileMigration } from './legacy-profile-migration.js'

describe('legacy profile migration policy', () => {
  it('retains the shared learner history only for the deployment owner', () => {
    expect(LegacyProfileMigration.retainSharedProfileId(administratorEmail)).toBe(true)
    expect(LegacyProfileMigration.retainSharedProfileId('another.allowed@example.com')).toBe(false)
  })
})

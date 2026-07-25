import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { ChildAvatarIdSchema, ChildProfileNameSchema, FamilyProfiles } from './family-profile.js'

describe('FamilyProfiles', () => {
  it('accepts only the named avatar presets exposed by the family-profile interface', () => {
    expect(FamilyProfiles.avatarIds).toEqual(['sprout', 'sunbeam', 'bluebell', 'berry'])
    expect(Schema.is(ChildAvatarIdSchema)('sprout')).toBe(true)
    expect(Schema.is(ChildAvatarIdSchema)('unknown-avatar')).toBe(false)
  })

  it('accepts a trimmed child name up to 40 characters', () => {
    expect(Schema.is(ChildProfileNameSchema)('Lou')).toBe(true)
    expect(Schema.is(ChildProfileNameSchema)('   ')).toBe(false)
    expect(Schema.is(ChildProfileNameSchema)('x'.repeat(41))).toBe(false)
  })
})

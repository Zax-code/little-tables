import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  ChildAvatarIdSchema,
  ChildProfileNameSchema,
  FamilyProfiles,
  SelectableChildAvatarIdSchema,
} from './family-profile.js'

describe('FamilyProfiles', () => {
  it('keeps legacy IDs decodable while exposing only approved distinct characters', () => {
    expect(FamilyProfiles.avatarIds).toEqual([
      'sprout',
      'malo-bear',
      'fenna-fox',
      'mina-cat',
      'paco-dog',
      'colin-mallard',
      'sunbeam',
      'bluebell',
      'berry',
    ])
    expect(FamilyProfiles.selectableAvatarIds).toEqual([
      'sprout',
      'malo-bear',
      'fenna-fox',
      'mina-cat',
      'paco-dog',
      'colin-mallard',
    ])
    expect(Schema.is(ChildAvatarIdSchema)('sprout')).toBe(true)
    expect(Schema.is(ChildAvatarIdSchema)('berry')).toBe(true)
    expect(Schema.is(SelectableChildAvatarIdSchema)('sprout')).toBe(true)
    expect(Schema.is(SelectableChildAvatarIdSchema)('paco-dog')).toBe(true)
    expect(Schema.is(SelectableChildAvatarIdSchema)('colin-mallard')).toBe(true)
    expect(Schema.is(SelectableChildAvatarIdSchema)('berry')).toBe(false)
    expect(Schema.is(ChildAvatarIdSchema)('unknown-avatar')).toBe(false)
  })

  it('accepts a trimmed family member name up to 40 characters', () => {
    expect(Schema.is(ChildProfileNameSchema)('Lou')).toBe(true)
    expect(Schema.is(ChildProfileNameSchema)('   ')).toBe(false)
    expect(Schema.is(ChildProfileNameSchema)('x'.repeat(41))).toBe(false)
  })
})

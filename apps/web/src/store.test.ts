import { describe, expect, it } from 'vitest'

import { practiceDatabaseName } from './store.js'

describe('profile practice store selection', () => {
  it('keeps the legacy single-profile database and gives every new child an isolated database', () => {
    expect(practiceDatabaseName('lou')).toBe('little-tables-v1')
    expect(practiceDatabaseName('child-1')).toBe('little-tables-v2:child-1')
    expect(practiceDatabaseName('child-2')).not.toBe(practiceDatabaseName('child-1'))
  })
})

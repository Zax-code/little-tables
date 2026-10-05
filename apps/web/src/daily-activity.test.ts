import type { Ce2Preferences } from '@little-tables/domain'
import { describe, expect, it } from 'vitest'

import { nextDailyFamily } from './daily-activity.js'

const preferences: Ce2Preferences = {
  enabledModules: ['arithmetic', 'fractions'],
  lastDailyFamily: null,
  schemaVersion: 'ce2-preferences/v1',
  updatedAt: new Date(0),
}

describe('daily activity rotation', () => {
  it('keeps the existing tables ritual before a module is chosen', () => {
    expect(nextDailyFamily({ ...preferences, enabledModules: [] })).toBe('tables')
  })

  it('gives every activated family a turn and then returns to tables', () => {
    expect(nextDailyFamily(preferences)).toBe('tables')
    expect(nextDailyFamily({ ...preferences, lastDailyFamily: 'tables' })).toBe('arithmetic')
    expect(nextDailyFamily({ ...preferences, lastDailyFamily: 'arithmetic' })).toBe('fractions')
    expect(nextDailyFamily({ ...preferences, lastDailyFamily: 'fractions' })).toBe('tables')
  })
})

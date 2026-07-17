import { describe, expect, it } from 'vitest'

import { deriveWeekProgressSegments } from './week-progress.js'

describe('deriveWeekProgressSegments', () => {
  it('fills weekly progress from left to right', () => {
    expect(deriveWeekProgressSegments(2)).toEqual([true, true, false, false, false, false, false])
  })

  it('keeps the seven-segment track within its bounds', () => {
    expect(deriveWeekProgressSegments(0)).toEqual([false, false, false, false, false, false, false])
    expect(deriveWeekProgressSegments(8)).toEqual([true, true, true, true, true, true, true])
  })
})

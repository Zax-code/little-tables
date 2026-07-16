import { describe, expect, it } from 'vitest'

import { decodeServerBootstrap } from './bootstrap-client.js'

describe('decodeServerBootstrap', () => {
  it('validates transported progress and revives snapshot dates', async () => {
    const bootstrap = await decodeServerBootstrap({
      algorithmVersion: '1',
      completedSessions: 3,
      gardenBloomCount: 1,
      practiceDayKeys: ['2026-07-16'],
      rewardedDayKeys: ['2026-07-16'],
      snapshot: {
        algorithmVersion: '1',
        facts: {
          '2:5': {
            correctCount: 1,
            correctStreak: 1,
            difficulty: 0.48,
            dueAt: '2026-07-17T12:00:00.000Z',
            lapseCount: 0,
            lastReviewedAt: '2026-07-16T12:00:00.000Z',
            lastReviewedDayKey: '2026-07-16',
            latencyMs: 1_500,
            recallDayKeys: [],
            stabilityDays: 1,
            state: 'learning',
            successfulDayKeys: ['2026-07-16'],
          },
        },
        processedEventIds: ['attempt-1'],
      },
    })

    expect(bootstrap.snapshot.facts['2:5']?.dueAt).toBeInstanceOf(Date)
    expect(bootstrap.snapshot.facts['2:5']?.lastReviewedAt).toBeInstanceOf(Date)
    expect(bootstrap.rewardedDayKeys).toEqual(['2026-07-16'])
  })

  it('rejects malformed transported mastery state', async () => {
    await expect(
      decodeServerBootstrap({
        snapshot: {
          algorithmVersion: '1',
          facts: { '2:5': { dueAt: 'not-a-date' } },
          processedEventIds: [],
        },
      }),
    ).rejects.toBeDefined()
  })

  it('normalizes a legacy bootstrap to one bloom per practiced day', async () => {
    const bootstrap = await decodeServerBootstrap({
      completedSessions: 4,
      practiceDayKeys: ['2026-07-10', '2026-07-12'],
      snapshot: { algorithmVersion: '1', facts: {}, processedEventIds: [] },
    })

    expect(bootstrap).toMatchObject({
      completedSessions: 4,
      gardenBloomCount: 2,
      rewardedDayKeys: ['2026-07-10', '2026-07-12'],
    })
  })
})

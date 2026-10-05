import { describe, expect, it } from 'vitest'
import { CE2_CONTENT_VERSION, Ce2Engine, LearningEngine } from '@little-tables/domain'

import { decodeServerBootstrap, fetchServerBootstrap } from './bootstrap-client.js'

describe('decodeServerBootstrap', () => {
  it('revives CE2 dates without granting capabilities to legacy responses', async () => {
    const base = { snapshot: LearningEngine.emptySnapshot() }
    const legacy = await decodeServerBootstrap(base)
    expect(legacy.ce2ContentVersion).toBeNull()
    expect(legacy.ce2Snapshot).toBeNull()
    const current = await decodeServerBootstrap({
      ...base,
      ce2ContentVersion: CE2_CONTENT_VERSION,
      ce2Snapshot: Ce2Engine.emptySnapshot(),
      ce2Preferences: {
        enabledModules: ['fractions'],
        lastDailyFamily: 'fractions',
        schemaVersion: 'ce2-preferences/v1',
        updatedAt: '2026-10-05T12:00:00.000Z',
      },
    })
    expect(current.ce2Preferences?.updatedAt).toBeInstanceOf(Date)
    expect(current.ce2Snapshot?.mastery).toEqual({})
  })

  it('falls back only for unsupported endpoints and preserves authentication failures', async () => {
    const calls: string[] = []
    const unsupported: typeof fetch = (input) => {
      calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      return Promise.resolve(new Response('{}', { status: calls.length === 1 ? 404 : 200 }))
    }
    expect((await fetchServerBootstrap('profile-a', unsupported)).status).toBe(200)
    expect(calls).toEqual(['/api/v2/bootstrap', '/api/v1/bootstrap'])
    calls.length = 0
    const unauthenticated: typeof fetch = (input) => {
      calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      return Promise.resolve(new Response('{}', { status: 401 }))
    }
    expect((await fetchServerBootstrap('profile-a', unauthenticated)).status).toBe(401)
    expect(calls).toEqual(['/api/v2/bootstrap'])
  })
  it('validates transported progress and revives snapshot dates', async () => {
    const flowerOrder = [...LearningEngine.gardenFlowerIds].reverse()
    const bootstrap = await decodeServerBootstrap({
      algorithmVersion: '1',
      completedSessions: 3,
      gardenBloomCount: 1,
      practiceDayKeys: ['2026-07-16'],
      rewardedDayKeys: ['2026-07-16'],
      gardenCollection: {
        awardedFlowerIds: [],
        bloomsPerFlower: 3,
        catalogVersion: '1',
        flowerOrder,
        introductionSeen: false,
      },
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
    expect(bootstrap.gardenCollection.flowerOrder).toEqual(flowerOrder)
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

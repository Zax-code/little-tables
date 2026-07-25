import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { GardenCollectionRepository } from './garden-collection-repository.js'
import { InMemoryGardenCollectionRepository } from './in-memory-garden-collection-repository.js'

describe('GardenCollectionRepository', () => {
  it('keeps one durable, duplicate-free flower order per learner and reconciles awards', async () => {
    const program = Effect.gen(function* () {
      const repository = yield* GardenCollectionRepository
      const learnerA = yield* repository.loadOrCreate({
        preferredFlowerPrefix: ['rose-lotus'],
        profileId: 'learner-a',
      })
      const learnerAAgain = yield* repository.loadOrCreate({
        preferredFlowerPrefix: ['blue-wisteria'],
        profileId: 'learner-a',
      })
      const learnerB = yield* repository.loadOrCreate({
        preferredFlowerPrefix: ['blue-wisteria'],
        profileId: 'learner-b',
      })
      const reconciled = yield* repository.reconcile('learner-a', {
        awardedFlowerIds: [learnerA.flowerOrder[0] ?? 'rose-lotus'],
        bloomCount: 3,
        rewardedDayKeys: ['2026-07-23', '2026-07-24', '2026-07-25'],
      })
      const withIntroSeen = yield* repository.markIntroductionSeen('learner-a')
      return { learnerA, learnerAAgain, learnerB, reconciled, withIntroSeen }
    }).pipe(Effect.provide(InMemoryGardenCollectionRepository.layer()))

    const result = await Effect.runPromise(program)

    expect(result.learnerAAgain.flowerOrder).toEqual(result.learnerA.flowerOrder)
    expect(result.learnerA.flowerOrder[0]).toBe('rose-lotus')
    expect(result.learnerB.flowerOrder[0]).toBe('blue-wisteria')
    expect(new Set(result.learnerA.flowerOrder).size).toBe(9)
    expect(result.reconciled).toMatchObject({
      awardedFlowerIds: [result.learnerA.flowerOrder[0]],
      bloomCount: 3,
      rewardedDayKeys: ['2026-07-23', '2026-07-24', '2026-07-25'],
    })
    expect(result.withIntroSeen.introductionSeen).toBe(true)
  })
})

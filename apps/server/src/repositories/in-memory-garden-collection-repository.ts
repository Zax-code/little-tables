import { gardenBloomsPerFlower } from '@little-tables/domain'
import { Effect, Layer } from 'effect'

import {
  GardenCollectionRepository,
  gardenCollectionCatalogVersion,
  personalizedFlowerOrder,
  type GardenCollectionRecord,
  type GardenCollectionRepositoryService,
  type LoadGardenCollectionInput,
} from './garden-collection-repository.js'

const layer = () => {
  const collections = new Map<string, GardenCollectionRecord>()

  const create = ({
    preferredFlowerPrefix,
    profileId,
  }: LoadGardenCollectionInput): GardenCollectionRecord => {
    const now = new Date()
    const record: GardenCollectionRecord = {
      awardedFlowerIds: [],
      bloomCount: 0,
      bloomsPerFlower: gardenBloomsPerFlower,
      catalogVersion: gardenCollectionCatalogVersion,
      createdAt: now,
      flowerOrder: personalizedFlowerOrder(preferredFlowerPrefix),
      introductionSeen: false,
      profileId,
      rewardedDayKeys: [],
      updatedAt: now,
    }
    collections.set(profileId, record)
    return record
  }

  const service: GardenCollectionRepositoryService = {
    health: Effect.void,
    loadOrCreate: (input) => Effect.sync(() => collections.get(input.profileId) ?? create(input)),
    markIntroductionSeen: (profileId) =>
      Effect.sync(() => {
        const current =
          collections.get(profileId) ?? create({ preferredFlowerPrefix: [], profileId })
        const updated = { ...current, introductionSeen: true, updatedAt: new Date() }
        collections.set(profileId, updated)
        return updated
      }),
    reconcile: (profileId, reconciliation) =>
      Effect.sync(() => {
        const current =
          collections.get(profileId) ?? create({ preferredFlowerPrefix: [], profileId })
        const awarded = new Set([...current.awardedFlowerIds, ...reconciliation.awardedFlowerIds])
        const updated: GardenCollectionRecord = {
          ...current,
          awardedFlowerIds: current.flowerOrder.filter((id) => awarded.has(id)),
          bloomCount: Math.max(current.bloomCount, reconciliation.bloomCount),
          rewardedDayKeys: [
            ...new Set([...current.rewardedDayKeys, ...reconciliation.rewardedDayKeys]),
          ].sort(),
          updatedAt: new Date(),
        }
        collections.set(profileId, updated)
        return updated
      }),
  }

  return Layer.succeed(GardenCollectionRepository, service)
}

export const InMemoryGardenCollectionRepository = { layer } as const

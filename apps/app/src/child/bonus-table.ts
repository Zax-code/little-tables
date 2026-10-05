/** Which bonus table (× 11 or × 12) a child should practise next. */
import type { LearningSnapshot } from '@little-tables/engine/schema'

/** The bonus table to practise: the one with fewer facts already fluent. */
export const weakerBonusTable = (snapshot: LearningSnapshot): 11 | 12 => {
  const fluent = (table: number) =>
    Object.entries(snapshot.facts).filter(
      ([key, fact]) =>
        fact.state === 'fluent' && key.split(':', 2).some((factor) => factor === String(table)),
    ).length
  return fluent(11) <= fluent(12) ? 11 : 12
}

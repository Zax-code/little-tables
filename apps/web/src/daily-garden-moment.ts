export type DailyGardenMoment =
  | 'bird'
  | 'breeze'
  | 'butterfly'
  | 'dew'
  | 'ladybug'
  | 'rain'
  | 'rainbow'
  | 'snail'
  | 'sunbeam'
  | 'wateringCan'

type DailyGardenMomentInput = Readonly<{
  bloomCount: number
  dayKey: string
}>

const quietGardenMoments: ReadonlyArray<DailyGardenMoment> = [
  'ladybug',
  'snail',
  'breeze',
  'dew',
  'bird',
  'rain',
  'wateringCan',
]

const bloomingGardenMoments: ReadonlyArray<DailyGardenMoment> = [
  ...quietGardenMoments,
  'butterfly',
  'sunbeam',
  'rainbow',
]

const stableHash = (value: string): number => {
  let hash = 2_166_136_261
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

export function dailyGardenMoment({
  bloomCount,
  dayKey,
}: DailyGardenMomentInput): DailyGardenMoment {
  const moments = bloomCount > 0 ? bloomingGardenMoments : quietGardenMoments
  return moments[stableHash(dayKey) % moments.length] ?? 'snail'
}

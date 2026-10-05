/** The garden's flowers in catalogue order, as `GARDEN_FLOWERS` in `crates/lt-domain`. */
export const gardenFlowerIds = [
  'rose-lotus',
  'twilight-lupine',
  'velvet-foxglove',
  'plum-snapdragon',
  'sunset-zinnia',
  'ruby-bleeding-heart',
  'blushing-peony',
  'ivory-magnolia',
  'blue-wisteria',
] as const
export type GardenFlowerId = (typeof gardenFlowerIds)[number]

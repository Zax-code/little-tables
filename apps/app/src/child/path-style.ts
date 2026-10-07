/** How each learning path shows: its mark and the colour of its tile. */
import type { PathId } from '@little-tables/engine/schema'

export const pathStyle: Readonly<Record<PathId, Readonly<{ mark: string; tile: string }>>> = {
  additions: { mark: '+ −', tile: 'bg-tint' },
  'big-numbers': { mark: '1 000', tile: 'bg-sky' },
  fractions: { mark: '¾', tile: 'bg-leaf' },
  conjugation: { mark: 'Aa', tile: 'bg-sun' },
}

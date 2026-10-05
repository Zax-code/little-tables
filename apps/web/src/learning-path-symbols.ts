import type { PathId } from '@little-tables/domain'

/** A short glyph for each path, shown in a pill beside its name. */
export const pathSymbols: Readonly<Record<PathId, string>> = {
  additions: '+ −',
  'big-numbers': '1 000',
  fractions: '¾',
}

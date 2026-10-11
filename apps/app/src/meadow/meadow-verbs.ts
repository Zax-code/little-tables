/** The verbs of the meadow's day, and how a sentence lists them. */
import type { MeadowVerb } from '@little-tables/engine/schema'

import type { Language } from '../data/schema.js'
import { displayVerb } from '../session/format.js'

/** The verbs a correct answer reached today, else the first ones: three at most. */
export const verbsOfToday = (verbs: ReadonlyArray<MeadowVerb>, todayKey: string) => {
  const today = verbs.filter((verb) => verb.lastWorkedDayKey === todayKey)
  return { today: today.length > 0, verbs: (today.length > 0 ? today : verbs).slice(0, 3) }
}

// List formatters are slow to build: one per language, built on first use.
const lists = new Map<Language, Intl.ListFormat>()

/** « aller », « être » et « chanter », in the child's language. */
export const listVerbs = (verbs: ReadonlyArray<MeadowVerb>, language: Language) => {
  const format = lists.get(language) ?? new Intl.ListFormat(language, { type: 'conjunction' })
  lists.set(language, format)
  return format.format(verbs.map((verb) => `« ${displayVerb(verb.verb)} »`))
}

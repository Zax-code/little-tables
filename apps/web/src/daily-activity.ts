import type { Ce2DailyFamily, Ce2Preferences } from '@little-tables/domain'

/** Keep tables in the ritual while rotating through the modules the learner chose. */
export function nextDailyFamily(preferences: Ce2Preferences): Ce2DailyFamily {
  const families: ReadonlyArray<Ce2DailyFamily> = ['tables', ...preferences.enabledModules]
  const previous = preferences.lastDailyFamily
  const index = previous === null ? -1 : families.indexOf(previous)
  return families[(index + 1) % families.length] ?? 'tables'
}

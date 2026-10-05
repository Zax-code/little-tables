import type { PracticeRhythm } from '@little-tables/engine/schema'

import type { Translator } from '../i18n/i18n.js'

const noon = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`)

/** The seven days of the week in bloom, labelled in the reader's language. */
export const weekDays = (rhythm: PracticeRhythm, { language, t }: Translator) => {
  const narrow = new Intl.DateTimeFormat(language, { timeZone: 'UTC', weekday: 'narrow' })
  const long = new Intl.DateTimeFormat(language, { timeZone: 'UTC', weekday: 'long' })
  return rhythm.week.map((day) => ({
    description: [
      long.format(noon(day.dayKey)),
      day.practiced ? t('week.watered') : null,
      day.today ? t('week.today') : null,
    ]
      .filter((part) => part !== null)
      .join(', '),
    label: narrow.format(noon(day.dayKey)).toLocaleUpperCase(language),
    practiced: day.practiced,
    today: day.today,
  }))
}

import type { PracticeRhythm } from '@little-tables/engine/schema'

import type { Translator } from '../i18n/translator.js'

const noon = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`)

/** The seven days of the week in bloom, labelled in the reader's language. */
export const weekDays = (rhythm: PracticeRhythm, { language, t, weekday }: Translator) => {
  return rhythm.week.map((day) => ({
    description: [
      weekday(noon(day.dayKey), 'long'),
      day.practiced ? t('week.watered') : null,
      day.today ? t('week.today') : null,
    ]
      .filter((part) => part !== null)
      .join(', '),
    label: weekday(noon(day.dayKey), 'narrow').toLocaleUpperCase(language),
    practiced: day.practiced,
    today: day.today,
  }))
}

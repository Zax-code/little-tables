/** Translating outside React: messages, plural forms, numbers and dates in one language. */
import type { Language } from '../data/schema.js'
import { messages } from './messages.js'

export type MessageKey = keyof typeof messages.en
export type MessageValues = Readonly<Record<string, number | string>>

const locales: Readonly<Record<Language, string>> = { en: 'en', fr: 'fr', 'zh-Hans': 'zh-Hans' }

type Formatters = Readonly<{
  numbers: Intl.NumberFormat
  plurals: Intl.PluralRules
  relative: Intl.RelativeTimeFormat
  weekdays: Readonly<{ long: Intl.DateTimeFormat; narrow: Intl.DateTimeFormat }>
}>

// Formatters are slow to build: one of each per language, built once.
const formatters = {} as Record<Language, Formatters>
for (const [language, locale] of Object.entries(locales) as ReadonlyArray<[Language, string]>) {
  formatters[language] = {
    numbers: new Intl.NumberFormat(locale),
    plurals: new Intl.PluralRules(locale),
    relative: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
    weekdays: {
      long: new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' }),
      narrow: new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'narrow' }),
    },
  }
}

export const interpolate = (template: string, values: MessageValues = {}) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )

export const createTranslator = (language: Language) => {
  const catalog = messages[language]
  const { numbers, plurals, relative, weekdays } = formatters[language]
  return {
    language,
    /** A message, with `{name}` placeholders replaced. */
    t: (key: MessageKey, values?: MessageValues) => interpolate(catalog[key], values),
    /** Picks the `.one` or `.other` form of a counted message. */
    count: (key: string, count: number, values: MessageValues = {}) => {
      const form = plurals.select(count) === 'one' ? 'one' : 'other'
      const template =
        (catalog as Readonly<Record<string, string>>)[`${key}.${form}`] ??
        (catalog as Readonly<Record<string, string>>)[`${key}.other`] ??
        key
      return interpolate(template, { count: numbers.format(count), ...values })
    },
    /** "yesterday", "3 days ago"… for a number of days before today. */
    daysAgo: (days: number) => relative.format(-days, 'day'),
    /** The day of the week of a UTC date. */
    weekday: (date: Date, width: keyof Formatters['weekdays']) => weekdays[width].format(date),
    number: (value: number) => numbers.format(value),
  }
}

export type Translator = ReturnType<typeof createTranslator>

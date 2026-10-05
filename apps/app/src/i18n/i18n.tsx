/**
 * Typed catalogues in French (default), English and Simplified Chinese
 * (`docs/rewrite/TECHNICAL_SPEC.md` §6.6). Each group of messages is written in English first;
 * the other languages must have exactly the same keys.
 */
import { createContext, use, useMemo, type ReactNode } from 'react'

import type { Language } from '../data/schema.js'
import { messages } from './messages.js'

export type MessageKey = keyof typeof messages.en
export type MessageValues = Readonly<Record<string, number | string>>

const locales: Readonly<Record<Language, string>> = { en: 'en', fr: 'fr', 'zh-Hans': 'zh-Hans' }

export const interpolate = (template: string, values: MessageValues = {}) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )

export const createTranslator = (language: Language) => {
  const catalog = messages[language]
  const numbers = new Intl.NumberFormat(locales[language])
  return {
    language,
    /** A message, with `{name}` placeholders replaced. */
    t: (key: MessageKey, values?: MessageValues) => interpolate(catalog[key], values),
    /** Picks the `.one` or `.other` form of a counted message. */
    count: (key: string, count: number, values: MessageValues = {}) => {
      const form = new Intl.PluralRules(locales[language]).select(count) === 'one' ? 'one' : 'other'
      const template =
        (catalog as Readonly<Record<string, string>>)[`${key}.${form}`] ??
        (catalog as Readonly<Record<string, string>>)[`${key}.other`] ??
        key
      return interpolate(template, { count: numbers.format(count), ...values })
    },
    number: (value: number) => numbers.format(value),
  }
}

export type Translator = ReturnType<typeof createTranslator>

const I18nContext = createContext<Translator>(createTranslator('fr'))

export function I18nProvider({
  children,
  language,
}: Readonly<{ children: ReactNode; language: Language }>) {
  const translator = useMemo(() => createTranslator(language), [language])
  return <I18nContext value={translator}>{children}</I18nContext>
}

export const useI18n = () => use(I18nContext)

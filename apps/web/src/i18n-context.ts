import { createContext } from 'react'

import {
  translate,
  type Locale,
  type TranslationKey,
  type TranslationValues,
} from './i18n-catalog.js'

export type I18nContextValue = Readonly<{
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, values?: TranslationValues) => string
}>

export const I18nContext = createContext<I18nContextValue>({
  locale: 'fr',
  setLocale: () => undefined,
  t: (key, values) => translate('fr', key, values),
})

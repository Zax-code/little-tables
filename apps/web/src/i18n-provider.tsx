import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import {
  translate,
  type Locale,
  type TranslationKey,
  type TranslationValues,
} from './i18n-catalog.js'
import { I18nContext } from './i18n-context.js'
import { persistLocalePreference, readLocalePreference } from './locale-preference.js'

export function I18nProvider({
  children,
  initialLocale,
}: PropsWithChildren<Readonly<{ initialLocale?: Locale }>>) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? readLocalePreference())
  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    if (typeof window !== 'undefined') persistLocalePreference(nextLocale)
  }, [])
  const t = useCallback(
    (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values),
    [locale],
  )
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <I18nContext value={value}>{children}</I18nContext>
}

import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import {
  resolveLocale,
  translate,
  type Locale,
  type TranslationKey,
  type TranslationValues,
} from './i18n-catalog.js'
import { I18nContext } from './i18n-context.js'

const localeStorageKey = 'little-tables:locale'

const readLocale = (): Locale => {
  try {
    return resolveLocale(
      typeof window === 'undefined' ? null : window.localStorage.getItem(localeStorageKey),
    )
  } catch {
    return 'fr'
  }
}

const persistLocale = (locale: Locale): void => {
  try {
    window.localStorage.setItem(localeStorageKey, locale)
  } catch {
    // A private browsing restriction should not prevent an in-session language change.
  }
}

export function I18nProvider({
  children,
  initialLocale,
}: PropsWithChildren<Readonly<{ initialLocale?: Locale }>>) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? readLocale())
  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    if (typeof window !== 'undefined') persistLocale(nextLocale)
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

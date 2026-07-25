import { resolveLocale, type Locale } from './i18n-catalog.js'

const localeStorageKey = 'little-tables:locale'

export const readLocalePreference = (): Locale => {
  try {
    return resolveLocale(
      typeof window === 'undefined' ? null : window.localStorage.getItem(localeStorageKey),
    )
  } catch {
    return 'fr'
  }
}

export const persistLocalePreference = (locale: Locale): void => {
  try {
    window.localStorage.setItem(localeStorageKey, locale)
  } catch {
    // A private browsing restriction should not prevent an in-session language change.
  }
}

export const applyLocalePreference = (
  locale: Locale,
  updateLocale: (locale: Locale) => void,
): void => {
  updateLocale(locale)
  if (typeof window !== 'undefined') persistLocalePreference(locale)
}

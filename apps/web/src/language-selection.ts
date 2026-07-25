import { resolveLocale, type Locale } from './i18n-catalog.js'

type SetLocale = (locale: Locale) => void
type SyncReminderLocale = (locale: Locale) => Promise<void>

export const selectLanguage = (
  value: string,
  setLocale: SetLocale,
  syncReminderLocale: SyncReminderLocale,
): void => {
  const locale = resolveLocale(value)
  setLocale(locale)
  void syncReminderLocale(locale).catch(() => undefined)
}

import { useI18n } from '../i18n.js'
import { syncExistingReminderLocale } from '../reminder-subscription.js'

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  const nextLocale = locale === 'fr' ? 'en' : 'fr'

  return (
    <button
      aria-label={
        nextLocale === 'en' ? t('language.switchToEnglish') : t('language.switchToFrench')
      }
      className="language-toggle"
      lang={nextLocale}
      onClick={() => {
        setLocale(nextLocale)
        void syncExistingReminderLocale(nextLocale).catch(() => undefined)
      }}
      type="button"
    >
      {nextLocale.toUpperCase()}
    </button>
  )
}

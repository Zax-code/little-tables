import { useI18n } from '../i18n.js'
import { syncExistingReminderLocale } from '../reminder-subscription.js'
import { useFamilyProfile } from '../use-family-profile.js'

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  const { activeProfile } = useFamilyProfile()
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
        void syncExistingReminderLocale(nextLocale, activeProfile.id).catch(() => undefined)
      }}
      type="button"
    >
      {nextLocale.toUpperCase()}
    </button>
  )
}

import { resolveLocale, useI18n } from '../i18n.js'
import { syncExistingReminderLocale } from '../reminder-subscription.js'
import { useFamilyProfile } from '../use-family-profile.js'

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()
  const { activeProfile } = useFamilyProfile()

  return (
    <select
      aria-label={t('language.choose')}
      className="language-toggle"
      lang={locale}
      onChange={(event) => {
        const nextLocale = resolveLocale(event.currentTarget.value)
        setLocale(nextLocale)
        void syncExistingReminderLocale(nextLocale, activeProfile.id).catch(() => undefined)
      }}
      value={locale}
    >
      <option lang="en" value="en">
        English
      </option>
      <option lang="fr" value="fr">
        Français
      </option>
      <option lang="zh-Hans" value="zh-Hans">
        简体中文
      </option>
    </select>
  )
}

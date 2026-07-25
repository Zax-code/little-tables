import { useI18n } from '../i18n.js'
import { selectLanguage } from '../language-selection.js'
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
        selectLanguage(event.currentTarget.value, setLocale, (nextLocale) =>
          syncExistingReminderLocale(nextLocale, activeProfile.id),
        )
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

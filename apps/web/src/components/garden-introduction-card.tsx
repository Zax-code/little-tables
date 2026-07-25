import { useI18n } from '../i18n.js'

export function GardenIntroductionCard({ onDismiss }: Readonly<{ onDismiss: () => void }>) {
  const { t } = useI18n()
  return (
    <aside className="garden-introduction-card">
      <span aria-hidden="true" className="garden-introduction-card__flower">
        ✿
      </span>
      <div>
        <strong>{t('gardenIntro.heading')}</strong>
        <p>{t('gardenIntro.copy')}</p>
      </div>
      <button onClick={onDismiss} type="button">
        {t('gardenIntro.dismiss')}
      </button>
    </aside>
  )
}

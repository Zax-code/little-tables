import type { Ce2Module, Ce2Skill } from '@little-tables/domain'

import { useI18n } from '../i18n.js'

type ActivityPickerProps = Readonly<{
  available: boolean
  busy: boolean
  onStart: (module: Ce2Module, skill?: Ce2Skill) => void
}>

export function ActivityPicker({ available, busy, onStart }: ActivityPickerProps) {
  const { t } = useI18n()
  const disabled = !available || busy

  return (
    <div className="activity-picker">
      {!available ? <p className="activity-picker__notice">{t('ce2.preparing')}</p> : null}
      {busy ? <p className="activity-picker__notice">{t('ce2.busy')}</p> : null}
      <fieldset className="activity-picker__group">
        <legend>
          <span aria-hidden="true">+ −</span> {t('ce2.arithmetic')}
        </legend>
        <p>{t('ce2.arithmeticIntro')}</p>
        <button disabled={disabled} onClick={() => onStart('arithmetic')} type="button">
          {t('ce2.mental')}
        </button>
        <div className="activity-picker__pair">
          <button disabled={disabled} onClick={() => onStart('arithmetic', 'A5')} type="button">
            + {t('ce2.columns')}
          </button>
          <button disabled={disabled} onClick={() => onStart('arithmetic', 'S5')} type="button">
            − {t('ce2.columns')}
          </button>
        </div>
        <button disabled={disabled} onClick={() => onStart('arithmetic', 'P1')} type="button">
          {t('ce2.problems')}
        </button>
      </fieldset>
      <fieldset className="activity-picker__group">
        <legend>
          <span aria-hidden="true">½</span> {t('ce2.fractions')}
        </legend>
        <p>{t('ce2.fractionsIntro')}</p>
        <button disabled={disabled} onClick={() => onStart('fractions', 'F1')} type="button">
          {t('ce2.discover')}
        </button>
        <button disabled={disabled} onClick={() => onStart('fractions', 'F4')} type="button">
          {t('ce2.compare')}
        </button>
        <button disabled={disabled} onClick={() => onStart('fractions', 'F6')} type="button">
          {t('ce2.measure')}
        </button>
        <button disabled={disabled} onClick={() => onStart('fractions', 'F7')} type="button">
          {t('ce2.calculate')}
        </button>
      </fieldset>
      <small className="activity-picker__reference">{t('ce2.courseReference')}</small>
    </div>
  )
}

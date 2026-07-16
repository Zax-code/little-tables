import type { ErrorComponentProps } from '@tanstack/react-router'
import { useState } from 'react'

import { updateRecoveryAsset } from '../assets.js'
import { reloadWithLatestServiceWorker } from '../service-worker-updates.js'
import { useI18n } from '../i18n.js'

export function AppErrorScreen({ reset }: ErrorComponentProps) {
  const { t } = useI18n()
  const [updating, setUpdating] = useState(false)

  return (
    <main className="app-error-screen">
      <div className="app-error-card">
        <img alt={t(updateRecoveryAsset.altKey)} src={updateRecoveryAsset.src} />
        <div className="app-error-copy">
          <p className="eyebrow">{t('error.eyebrow')}</p>
          <h1>{t('error.title')}</h1>
          <p>{t('error.copy')}</p>
        </div>
        <div className="app-error-actions">
          <button
            className="primary-button"
            disabled={updating}
            onClick={() => {
              setUpdating(true)
              void reloadWithLatestServiceWorker()
            }}
            type="button"
          >
            {t(updating ? 'error.updating' : 'error.update')}
          </button>
          <button className="mode-link" onClick={reset} type="button">
            {t('error.retry')}
          </button>
        </div>
      </div>
    </main>
  )
}

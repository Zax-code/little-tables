import type { ErrorComponentProps } from '@tanstack/react-router'
import { useState } from 'react'

import { reloadWithLatestServiceWorker } from '../service-worker-updates.js'
import { useI18n } from '../i18n.js'
import { useCharacterAssetFallback } from '../use-character-asset-fallback.js'

export function AppErrorScreen(_props: ErrorComponentProps) {
  const { t } = useI18n()
  const visual = useCharacterAssetFallback('updateRecovery')
  const asset = visual.asset
  const [updating, setUpdating] = useState(false)

  return (
    <main className="app-error-screen">
      <div className="app-error-card">
        {visual.showRetry ? (
          <button className="character-asset-retry" onClick={visual.retry} type="button">
            {t('asset.retry')}
          </button>
        ) : (
          <img
            alt={t(asset.altKey, { character: visual.characterName })}
            data-character={visual.selectedCharacterId}
            height={asset.height}
            key={visual.key}
            onError={visual.onError}
            src={asset.src}
            width={asset.width}
          />
        )}
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
        </div>
      </div>
    </main>
  )
}

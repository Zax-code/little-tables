import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useState } from 'react'

import { startServiceWorkerUpdateChecks } from '../service-worker-updates.js'
import { useI18n } from '../i18n.js'

export function PwaManager({
  practiceActive = false,
}: Readonly<{ practiceActive?: boolean }> = {}) {
  const { t } = useI18n()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_serviceWorkerUrl, nextRegistration) => {
      setRegistration(nextRegistration ?? null)
    },
  })

  useEffect(() => {
    if (registration === null) return
    return startServiceWorkerUpdateChecks(registration)
  }, [registration])

  if (!needRefresh && !offlineReady) return null

  return (
    <aside aria-live="polite" className="pwa-toast" role="status">
      <span>{needRefresh ? t('pwa.refreshReady') : t('pwa.offlineReady')}</span>
      {needRefresh ? (
        <button
          disabled={practiceActive}
          onClick={() => {
            if (!practiceActive) void updateServiceWorker(true)
          }}
          type="button"
        >
          {t(practiceActive ? 'ce2.updateLater' : 'pwa.update')}
        </button>
      ) : (
        <button onClick={() => setOfflineReady(false)} type="button">
          {t('pwa.okay')}
        </button>
      )}
      {needRefresh ? null : (
        <button
          aria-label={t('common.dismiss')}
          onClick={() => setOfflineReady(false)}
          type="button"
        >
          ×
        </button>
      )}
    </aside>
  )
}

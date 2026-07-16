import { useRegisterSW } from 'virtual:pwa-register/react'
import { useRouterState } from '@tanstack/react-router'

import { useI18n } from '../i18n.js'

export function PwaManager() {
  const { t } = useI18n()
  const inPractice = useRouterState({ select: ({ location }) => location.pathname === '/practice' })
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if ((!needRefresh && !offlineReady) || (needRefresh && inPractice)) return null

  return (
    <aside className="pwa-toast" role="status">
      <span>{needRefresh ? t('pwa.refreshReady') : t('pwa.offlineReady')}</span>
      {needRefresh ? (
        <button onClick={() => void updateServiceWorker(true)} type="button">
          {t('pwa.update')}
        </button>
      ) : (
        <button onClick={() => setOfflineReady(false)} type="button">
          {t('pwa.okay')}
        </button>
      )}
      <button
        aria-label={t('common.dismiss')}
        onClick={() => {
          setNeedRefresh(false)
          setOfflineReady(false)
        }}
        type="button"
      >
        ×
      </button>
    </aside>
  )
}

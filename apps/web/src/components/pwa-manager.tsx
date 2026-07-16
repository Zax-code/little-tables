import { useRegisterSW } from 'virtual:pwa-register/react'
import { useRouterState } from '@tanstack/react-router'

export function PwaManager() {
  const inPractice = useRouterState({ select: ({ location }) => location.pathname === '/practice' })
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if ((!needRefresh && !offlineReady) || (needRefresh && inPractice)) return null

  return (
    <aside className="pwa-toast" role="status">
      <span>{needRefresh ? 'a fresh little version is ready' : 'ready for offline tiny wins'}</span>
      {needRefresh ? (
        <button onClick={() => void updateServiceWorker(true)} type="button">
          update
        </button>
      ) : (
        <button onClick={() => setOfflineReady(false)} type="button">
          okay
        </button>
      )}
      <button
        aria-label="Dismiss"
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

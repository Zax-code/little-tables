import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaManager() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh && !offlineReady) return null

  return (
    <aside className="pwa-toast" role="status">
      <span>{needRefresh ? 'a fresh little version is ready' : 'ready for offline tiny wins'}</span>
      {needRefresh ? (
        <button onClick={() => void updateServiceWorker(true)}>update</button>
      ) : (
        <button onClick={() => setOfflineReady(false)}>okay</button>
      )}
      <button
        aria-label="Dismiss"
        onClick={() => {
          setNeedRefresh(false)
          setOfflineReady(false)
        }}
      >
        ×
      </button>
    </aside>
  )
}

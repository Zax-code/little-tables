import { useState } from 'react'

const DISMISSED_KEY = 'little-tables:install-dismissed'

export function InstallCard({ completedSessions }: Readonly<{ completedSessions: number }>) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'yes')
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  if (completedSessions < 1 || dismissed || standalone) return null

  return (
    <aside className="install-card">
      <div>
        <strong>keep little tables close ♡</strong>
        <p>On iPhone, tap Share and then “Add to Home Screen”.</p>
      </div>
      <button
        aria-label="Dismiss install tip"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, 'yes')
          setDismissed(true)
        }}
      >
        ×
      </button>
    </aside>
  )
}

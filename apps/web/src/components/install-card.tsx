import { useState } from 'react'

import { useI18n } from '../i18n.js'

const DISMISSED_KEY = 'little-tables:install-dismissed'

export function InstallCard({ completedSessions }: Readonly<{ completedSessions: number }>) {
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'yes')
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  if (completedSessions < 1 || dismissed || standalone) return null

  return (
    <aside className="install-card">
      <div>
        <strong>{t('install.title')}</strong>
        <p>{t('install.copy')}</p>
      </div>
      <button
        aria-label={t('install.dismiss')}
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, 'yes')
          setDismissed(true)
        }}
        type="button"
      >
        ×
      </button>
    </aside>
  )
}

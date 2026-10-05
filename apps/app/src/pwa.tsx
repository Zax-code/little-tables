/** The non-blocking "new version" banner (mockup B5). */
import { Button } from '@little-tables/ui'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useI18n } from './i18n/i18n.js'
import {
  isUpdateWaiting,
  onUpdateWaiting,
  reloadWithLatestServiceWorker,
} from './service-worker-client.js'

/** B5: a new version is ready; the child can finish what they are doing. */
export function UpdateBanner() {
  const { t } = useI18n()
  const [ready, setReady] = useState(isUpdateWaiting)
  useEffect(() => onUpdateWaiting(() => setReady(true)), [])
  if (!ready) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 safe-top">
      <div
        className="pointer-events-auto mt-2 flex w-full max-w-md items-center gap-3 rounded-card bg-surface p-3 shadow-[0_8px_24px_var(--lt-shadow)]"
        role="status"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-leaf-soft text-leaf">
          <Sparkles aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className="text-subhead font-extrabold">{t('pwa.updateTitle')}</strong>
          <span className="text-footnote font-semibold text-label-2">{t('pwa.updateCopy')}</span>
        </div>
        <Button onClick={() => void reloadWithLatestServiceWorker()} size="sm">
          {t('pwa.update')}
        </Button>
      </div>
    </div>
  )
}

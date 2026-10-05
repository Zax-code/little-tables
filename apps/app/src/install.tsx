/**
 * Installing the app on the home screen (`docs/rewrite/TECHNICAL_SPEC.md` §4.5): the browser's own
 * prompt where it exists, instructions on iPhone and iPad.
 */
import { Button, IconButton, Sheet } from '@little-tables/ui'
import { Share, X } from 'lucide-react'
import { useI18n } from './i18n/i18n.js'
import { useInstall } from './install-prompt.js'

export function InstallSteps({
  onOpenChange,
  open,
}: Readonly<{ onOpenChange: (open: boolean) => void; open: boolean }>) {
  const { t } = useI18n()
  return (
    <Sheet
      closeLabel={t('common.close')}
      onOpenChange={onOpenChange}
      open={open}
      title={t('install.title')}
    >
      <p className="flex items-center gap-2 text-body text-label-2">
        <Share aria-hidden className="size-5 shrink-0 text-sky" />
        {t('install.ios')}
      </p>
      <Button onClick={() => onOpenChange(false)} variant="tinted" width="full">
        {t('rules.done')}
      </Button>
    </Sheet>
  )
}

/** Shown once, after the first session, when the app is not installed yet. */
export function InstallCard({ onDismiss }: Readonly<{ onDismiss: () => void }>) {
  const { t } = useI18n()
  const { explaining, install, setExplaining } = useInstall()
  return (
    <section className="flex items-center gap-3 rounded-card bg-sky-soft p-3 text-left">
      <div className="flex min-w-0 flex-1 flex-col">
        <strong className="text-subhead font-extrabold">{t('install.title')}</strong>
        <span className="text-footnote font-semibold text-label-2">{t('install.copy')}</span>
      </div>
      <Button onClick={install} size="sm" variant="tinted">
        {t('install.action')}
      </Button>
      <IconButton label={t('common.close')} onClick={onDismiss} tone="glass">
        <X aria-hidden className="size-4" />
      </IconButton>
      <InstallSteps onOpenChange={setExplaining} open={explaining} />
    </section>
  )
}

/**
 * Once per child, the day tables 1–10 are well rooted: the new paths open in the garden
 * (`docs/rewrite/TECHNICAL_SPEC.md` §6.2). Afterwards they live in "Other sessions".
 */
import type { PathProgress } from '@little-tables/engine/schema'
import { Button, Sheet } from '@little-tables/ui'
import { useState } from 'react'

import { useApp } from '../app/app-context.js'
import { useI18n } from '../i18n/i18n.js'
import { pathStyle } from './path-style.js'

type NewPathsSheetProps = Readonly<{
  paths: ReadonlyArray<PathProgress>
  tablesAcquired: boolean
}>

export function NewPathsSheet({ paths, tablesAcquired }: NewPathsSheetProps) {
  const { activeProfile, device } = useApp()
  const { t } = useI18n()
  const [seen, setSeen] = useState(() => device.sawNewPaths(activeProfile.id))
  const open = paths.filter((path) => path.open)
  const showing =
    !seen && tablesAcquired && activeProfile.learningPaths.mode === 'automatic' && open.length > 0
  const dismiss = () => {
    device.markCardSeen(`new-paths:${activeProfile.id}`)
    setSeen(true)
  }
  return (
    <Sheet
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
      open={showing}
      title={t('home.newPathHeading')}
    >
      <div className="flex flex-col gap-5 pb-2">
        <div aria-hidden className="flex justify-center gap-3">
          {open.map((path) => (
            <span
              className={`flex h-14 w-16 items-center justify-center rounded-card text-headline font-black text-on-tint ${pathStyle[path.id].tile}`}
              key={path.id}
            >
              {pathStyle[path.id].mark}
            </span>
          ))}
        </div>
        <p className="text-center text-body font-semibold text-label-2">{t('home.newPathCopy')}</p>
        <Button onClick={dismiss} width="full">
          {t('home.newPathAction')}
        </Button>
      </div>
    </Sheet>
  )
}

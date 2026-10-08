/** How a garden grows: a few illustrated rules in a sheet (D4, D12). */
import { Button, IconTile, Sheet } from '@little-tables/ui'
import type { LucideIcon } from 'lucide-react'

import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'

export type Rule = Readonly<{ copy: MessageKey; icon: LucideIcon; tile: string; title: MessageKey }>

export function RulesSheet({
  onOpenChange,
  open,
  rules,
  title,
}: Readonly<{
  onOpenChange: (open: boolean) => void
  open: boolean
  rules: readonly Rule[]
  title: MessageKey
}>) {
  const { t } = useI18n()
  return (
    <Sheet onOpenChange={onOpenChange} open={open} title={t(title)}>
      <ul className="flex flex-col gap-4">
        {rules.map(({ copy, icon: Icon, tile, title: rule }) => (
          <li className="flex items-start gap-3" key={rule}>
            <IconTile className={tile}>
              <Icon aria-hidden />
            </IconTile>
            <div className="flex flex-col">
              <h3 className="text-body font-extrabold">{t(rule)}</h3>
              <p className="text-subhead text-label-2">{t(copy)}</p>
            </div>
          </li>
        ))}
      </ul>
      <Button onClick={() => onOpenChange(false)} variant="tinted" width="full">
        {t('rules.done')}
      </Button>
    </Sheet>
  )
}

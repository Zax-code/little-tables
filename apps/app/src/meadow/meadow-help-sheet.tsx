/** D12: how a verb grows in the meadow, four rules. */
import { Button, IconTile, Sheet } from '@little-tables/ui'
import { Droplets, Flower, Sparkles, Sprout } from 'lucide-react'

import { useI18n } from '../i18n/i18n.js'

const rules = [
  { copy: 'meadow.rule.flowerCopy', icon: Flower, tile: 'bg-sun', title: 'meadow.rule.flower' },
  { copy: 'meadow.rule.petalCopy', icon: Sprout, tile: 'bg-tint', title: 'meadow.rule.petal' },
  {
    copy: 'meadow.rule.butterfliesCopy',
    icon: Sparkles,
    tile: 'bg-sky',
    title: 'meadow.rule.butterflies',
  },
  { copy: 'meadow.rule.dailyCopy', icon: Droplets, tile: 'bg-leaf', title: 'meadow.rule.daily' },
] as const

export function MeadowHelpSheet({
  onOpenChange,
  open,
}: Readonly<{ onOpenChange: (open: boolean) => void; open: boolean }>) {
  const { t } = useI18n()
  return (
    <Sheet onOpenChange={onOpenChange} open={open} title={t('meadow.help')}>
      <ul className="flex flex-col gap-4">
        {rules.map(({ copy, icon: Icon, tile, title }) => (
          <li className="flex items-start gap-3" key={title}>
            <IconTile className={tile}>
              <Icon aria-hidden />
            </IconTile>
            <div className="flex flex-col">
              <h3 className="text-body font-extrabold">{t(title)}</h3>
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

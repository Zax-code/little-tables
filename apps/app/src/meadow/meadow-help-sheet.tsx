/** D12: how a verb grows in the meadow, four rules. */
import { Droplets, Flower, Sparkles, Sprout } from 'lucide-react'

import { type Rule, RulesSheet } from '../garden/rules-sheet.js'

const rules: readonly Rule[] = [
  { copy: 'meadow.rule.flowerCopy', icon: Flower, tile: 'bg-sun', title: 'meadow.rule.flower' },
  { copy: 'meadow.rule.petalCopy', icon: Sprout, tile: 'bg-tint', title: 'meadow.rule.petal' },
  {
    copy: 'meadow.rule.butterfliesCopy',
    icon: Sparkles,
    tile: 'bg-sky',
    title: 'meadow.rule.butterflies',
  },
  { copy: 'meadow.rule.dailyCopy', icon: Droplets, tile: 'bg-leaf', title: 'meadow.rule.daily' },
]

export function MeadowHelpSheet({
  onOpenChange,
  open,
}: Readonly<{ onOpenChange: (open: boolean) => void; open: boolean }>) {
  return <RulesSheet onOpenChange={onOpenChange} open={open} rules={rules} title="meadow.help" />
}

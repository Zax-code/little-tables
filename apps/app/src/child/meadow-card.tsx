/** A1: the meadow's side of Today, its card and its watering, beside the maths garden's. */
import type { MeadowProgress } from '@little-tables/engine/schema'
import { Button } from '@little-tables/ui'
import { Flower2 } from 'lucide-react'

import { useApp } from '../app/app-context.js'
import { policies } from '../data/practice.js'
import { useI18n } from '../i18n/i18n.js'
import { MeadowPlant } from '../meadow/meadow-plant.js'
import { displayVerb } from '../session/format.js'
import { useLaunch } from './launch.js'

type MeadowCardProps = Readonly<{
  blooms: number
  done: boolean
  meadow: MeadowProgress
}>

/** The verb that has waited longest, or how the meadow is doing. */
export function MeadowCard({ blooms, done, meadow }: MeadowCardProps) {
  const { count, t } = useI18n()
  const thirst = done ? null : meadow.thirst
  const flower = meadow.verbs.find((verb) => verb.verb === thirst?.verb) ?? meadow.verbs[0] ?? null
  const verb = thirst === null ? '' : displayVerb(thirst.verb)
  const [title, copy] =
    thirst === null
      ? [t(done ? 'today.meadowDone' : 'today.meadowWaiting'), count('today.meadowBlooms', blooms)]
      : thirst.daysSince === 0
        ? [t('today.meadowFirst', { verb }), t('today.meadowFirstCopy')]
        : [t('today.meadowThirsty', { verb }), t('today.meadowSince', { days: thirst.daysSince })]
  return (
    <section className="flex items-center gap-3 rounded-card bg-sun-soft p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-caption font-black tracking-wider text-sun uppercase">
          {t('today.meadowEyebrow')}
        </p>
        <h2 className="text-title-3 font-extrabold">{title}</h2>
        <p className="text-footnote font-semibold text-label-2">{copy}</p>
      </div>
      {flower === null ? null : <MeadowPlant className="h-24 w-auto shrink-0" verb={flower} />}
    </section>
  )
}

/** Waters the meadow; once it bloomed today, more verbs for fun. */
export function MeadowButton({ done }: Readonly<{ done: boolean }>) {
  const { activeProfile } = useApp()
  const { t } = useI18n()
  const launch = useLaunch()
  return (
    <Button
      className="bg-sun shadow-[0_6px_16px_color-mix(in_srgb,var(--lt-sun)_25%,transparent)]"
      disabled={launch.pending}
      icon={<Flower2 aria-hidden className="size-5" />}
      onClick={() => void launch.start(policies.meadow(activeProfile.learningPaths))}
      size="lg"
      width="full"
    >
      {t(done ? 'today.meadowAgain' : 'today.waterMeadow')}
    </Button>
  )
}

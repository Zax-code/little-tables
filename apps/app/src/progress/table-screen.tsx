/** D6: the facts of one table, coloured by how rooted they are. Never a score. */
import type { FactMastery } from '@little-tables/engine/schema'
import { Button, cn, NavigationBar, Screen } from '@little-tables/ui'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Target } from 'lucide-react'

import { useProfileState } from '../app/profile-state.js'
import { useLaunch } from '../child/launch.js'
import { policies } from '../data/practice.js'
import { useI18n } from '../i18n/i18n.js'

const stateStyle: Readonly<Record<FactMastery['state'], string>> = {
  familiar: 'bg-sky-soft text-sky',
  fluent: 'bg-leaf-soft text-leaf',
  learning: 'bg-sun-soft text-sun',
  unseen: 'bg-surface-2 text-label-3',
}

const legend = [
  { key: 'progress.legend.rooted', tone: 'bg-leaf' },
  { key: 'progress.legend.familiar', tone: 'bg-sky' },
  { key: 'progress.legend.growing', tone: 'bg-sun' },
  { key: 'progress.legend.unseen', tone: 'bg-label-3' },
] as const

/** D6: the facts of one table, coloured by how rooted they are. */
export function TableScreen() {
  const { table } = useParams({ from: '/progress/tables/$table' })
  const state = useProfileState()
  const { t } = useI18n()
  const navigate = useNavigate()
  const launch = useLaunch()
  const number = Number(table)
  if (state.data === undefined || !Number.isInteger(number)) return <Screen>{null}</Screen>
  const facts = Array.from({ length: 10 }, (_, index) => {
    const other = index + 1
    const key = `${Math.min(number, other)}:${Math.max(number, other)}`
    return { other, state: state.data.snapshot.facts[key]?.state ?? 'unseen' }
  })
  const rooted = facts.filter((fact) => fact.state === 'fluent').length
  return (
    <Screen
      bottom={
        <Button
          disabled={launch.pending}
          icon={<Target aria-hidden className="size-5" />}
          onClick={() => void launch.start(policies.table(number))}
          size="lg"
          width="full"
        >
          {t('progress.practiseTable', { table: number })}
        </Button>
      }
      top={
        <NavigationBar
          back={{ label: t('progress.back'), onBack: () => void navigate({ to: '/progress' }) }}
          title={t('progress.tableTitle', { table: number })}
        />
      }
    >
      <p className="-mt-3 px-1 text-subhead font-semibold text-label-2">
        {t('progress.tableRooted', { rooted, total: facts.length })}
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {facts.map((fact) => (
          <li
            className={cn(
              'flex items-center justify-between rounded-control px-4 py-3 font-black',
              stateStyle[fact.state],
            )}
            key={fact.other}
          >
            <span className="text-label">
              {number} × {fact.other}
            </span>
            <span className="tabular">{fact.state === 'unseen' ? '?' : number * fact.other}</span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1">
        {legend.map((item) => (
          <li
            className="flex items-center gap-1.5 text-footnote font-semibold text-label-2"
            key={item.key}
          >
            <span aria-hidden className={cn('size-2 rounded-full', item.tone)} />
            {t(item.key)}
          </li>
        ))}
      </ul>
    </Screen>
  )
}

/** D5 and D6: what is rooted, table by table, and the learning paths. Never a score. */
import type { FactMastery, LearningProgress } from '@little-tables/engine/schema'
import { Button, cn, IconTile, ListGroup, ListRow, NavigationBar, Screen } from '@little-tables/ui'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Lock, Route, Target } from 'lucide-react'

import { useApp, useProfileState } from '../app/app-context.js'
import { useLearningProgress } from '../app/derived.js'
import { ChildTabBar } from '../child/chrome.js'
import { useLaunch } from '../child/launch.js'
import { policies } from '../data/practice.js'
import type { ProfileState } from '../data/schema.js'
import { useI18n, type MessageKey } from '../i18n/i18n.js'

type Counts = LearningProgress['facts']

/** A bar split into rooted, on their way and still to discover. */
function StackedBar({ counts }: Readonly<{ counts: Counts }>) {
  const share = (value: number) => `${(value / Math.max(1, counts.total)) * 100}%`
  return (
    <span aria-hidden className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span className="bg-leaf" style={{ width: share(counts.fluent) }} />
      <span className="bg-sky" style={{ width: share(counts.familiar) }} />
      <span className="bg-sun" style={{ width: share(counts.growing) }} />
    </span>
  )
}

export function ProgressScreen() {
  const state = useProfileState()
  if (state.data === undefined) return <Screen bottom={<ChildTabBar />}>{null}</Screen>
  return <Progress state={state.data} />
}

function Progress({ state }: Readonly<{ state: ProfileState }>) {
  const { activeProfile } = useApp()
  const { count, t } = useI18n()
  const navigate = useNavigate()
  const progress = useLearningProgress(state, activeProfile.learningPaths)
  const openSkills = progress.paths.flatMap((path) =>
    path.skills.filter((skill) => skill.open),
  ).length
  const tiles = [
    { label: t('progress.familiar'), value: progress.facts.familiar },
    { label: t('progress.growing'), value: progress.facts.growing },
    { label: t('progress.sessions'), value: state.completedSessions },
  ]
  return (
    <Screen bottom={<ChildTabBar />}>
      <h1 className="px-1 pt-4 text-large-title font-extrabold">{t('progress.title')}</h1>
      <section className="flex flex-col gap-3 rounded-card bg-leaf-soft p-4">
        <p className="flex items-baseline gap-2">
          <span className="text-[2.75rem] leading-none font-black text-leaf tabular">
            {progress.facts.fluent}
          </span>
          <span className="text-callout font-extrabold text-leaf">{t('progress.rooted')}</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <div className="flex flex-col rounded-control bg-surface px-3 py-2" key={tile.label}>
              <span className="text-title-3 font-black tabular">{tile.value}</span>
              <span className="text-caption font-bold text-label-2">{tile.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-title-3 font-extrabold">{t('progress.tables')}</h2>
        <ul className="grid grid-cols-3 gap-2">
          {progress.tables
            .filter(({ table }) => table >= 2)
            .map(({ facts, table }) => (
              <li key={table}>
                <button
                  aria-label={t('progress.tableLabel', {
                    rooted: facts.fluent,
                    table,
                    total: facts.total,
                  })}
                  className="flex w-full flex-col gap-2 rounded-control bg-surface px-3 py-3 text-left active:scale-[0.98]"
                  onClick={() =>
                    void navigate({
                      params: { table: String(table) },
                      to: '/progress/tables/$table',
                    })
                  }
                  type="button"
                >
                  <span className="text-title-3 font-black">× {table}</span>
                  <StackedBar counts={facts} />
                </button>
              </li>
            ))}
        </ul>
      </section>

      <ListGroup>
        <ListRow
          detail={count('progress.pathsOpen', openSkills)}
          leading={
            <IconTile className="bg-sky">
              <Route aria-hidden />
            </IconTile>
          }
          onClick={() => void navigate({ to: '/progress/paths' })}
          title={t('progress.paths')}
          trailing="chevron"
        />
      </ListGroup>
    </Screen>
  )
}

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

/** My paths: each opened skill, how rooted it is, and a session to practise it. */
export function PathsScreen() {
  const state = useProfileState()
  if (state.data === undefined) return <Screen>{null}</Screen>
  return <Paths state={state.data} />
}

function Paths({ state }: Readonly<{ state: ProfileState }>) {
  const { activeProfile } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  const launch = useLaunch()
  const progress = useLearningProgress(state, activeProfile.learningPaths)
  return (
    <Screen
      top={
        <NavigationBar
          back={{ label: t('progress.back'), onBack: () => void navigate({ to: '/progress' }) }}
          title={t('progress.paths')}
        />
      }
    >
      {progress.paths.map((path) => (
        <ListGroup key={path.id} title={t(`path.${path.id}` as MessageKey)}>
          {path.skills.map((skill) => (
            <ListRow
              disabled={!skill.open || launch.pending}
              key={skill.id}
              subtitle={<CountsBar counts={skill} />}
              title={t(`skill.${skill.id}`)}
              {...(skill.open
                ? {
                    detail: `${skill.fluent}/${skill.total}`,
                    onClick: () =>
                      void launch.start(policies.skill(activeProfile.learningPaths, skill.id)),
                    trailing: 'chevron' as const,
                  }
                : { leading: <Lock aria-hidden className="size-4 text-label-3" /> })}
            />
          ))}
        </ListGroup>
      ))}
    </Screen>
  )
}

function CountsBar({ counts }: Readonly<{ counts: Counts }>) {
  return (
    <span className="mt-1 block w-32">
      <StackedBar counts={counts} />
    </span>
  )
}

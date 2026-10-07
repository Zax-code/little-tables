/** D5: what is rooted, table by table, with a way to the learning paths. Never a score. */
import { IconTile, ListGroup, ListRow, Screen } from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'
import { CaseLower, Route } from 'lucide-react'

import { useApp } from '../app/app-context.js'
import { useLearningProgress } from '../app/derived.js'
import { useProfileState } from '../app/profile-state.js'
import { ChildTabBar } from '../child/chrome.js'
import type { ProfileState } from '../data/schema.js'
import { useI18n } from '../i18n/i18n.js'
import { StackedBar } from './bars.js'

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
          {progress.tables.flatMap(({ facts, table }) =>
            table < 2
              ? []
              : [
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
                  </li>,
                ],
          )}
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
        {(progress.conjugation ?? []).length === 0 ? null : (
          <ListRow
            detail={count('verbs.count', progress.conjugation?.length ?? 0)}
            leading={
              <IconTile className="bg-sun">
                <CaseLower aria-hidden />
              </IconTile>
            }
            onClick={() => void navigate({ to: '/progress/verbs' })}
            title={t('progress.verbs')}
            trailing="chevron"
          />
        )}
      </ListGroup>
    </Screen>
  )
}

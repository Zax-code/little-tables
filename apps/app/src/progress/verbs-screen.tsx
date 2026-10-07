/** D7: the verbs a parent ticked, one row per verb and one dot per ticked tense. Never a score. */
import type { MasteryState, Tense } from '@little-tables/engine/schema'
import { cn, NavigationBar, Screen } from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'

import { useApp } from '../app/app-context.js'
import { useLearningProgress } from '../app/derived.js'
import { useProfileState } from '../app/profile-state.js'
import { useLaunch } from '../child/launch.js'
import { policies } from '../data/practice.js'
import type { ProfileState } from '../data/schema.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { displayVerb } from '../session/format.js'

const dot: Readonly<Record<MasteryState, string>> = {
  familiar: 'bg-sun',
  fluent: 'bg-leaf',
  learning: 'bg-sun-soft border-2 border-sun',
  unseen: 'bg-separator',
}

const legend: ReadonlyArray<readonly [MasteryState, MessageKey]> = [
  ['fluent', 'progress.legend.rooted'],
  ['familiar', 'progress.legend.familiar'],
  ['learning', 'progress.legend.growing'],
  ['unseen', 'progress.legend.unseen'],
]

const stateLabel: Readonly<Record<MasteryState, MessageKey>> = {
  familiar: 'progress.legend.familiar',
  fluent: 'progress.legend.rooted',
  learning: 'progress.legend.growing',
  unseen: 'progress.legend.unseen',
}

export function VerbsScreen() {
  const state = useProfileState()
  if (state.data === undefined) return <Screen>{null}</Screen>
  return <Verbs state={state.data} />
}

function Verbs({ state }: Readonly<{ state: ProfileState }>) {
  const { activeProfile } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  const launch = useLaunch()
  const paths = activeProfile.learningPaths
  const progress = useLearningProgress(state, paths)
  const verbs = progress.conjugation ?? []
  const tenses: ReadonlyArray<Tense> = verbs[0]?.tenses.map(({ tense }) => tense) ?? []
  return (
    <Screen
      top={
        <NavigationBar
          back={{ label: t('progress.back'), onBack: () => void navigate({ to: '/progress' }) }}
          title={t('progress.verbs')}
        />
      }
    >
      <section className="overflow-hidden rounded-card bg-surface">
        <div aria-hidden className="flex items-center px-4 py-2.5">
          <span className="flex-1" />
          {tenses.map((tense) => (
            <span
              className="w-12 text-center text-footnote font-extrabold text-label-2"
              key={tense}
              lang="fr"
            >
              {t(`conj.tenseShort.${tense}`)}
            </span>
          ))}
        </div>
        <ul>
          {verbs.map(({ tenses: states, verb }) => (
            <li className="border-t border-separator" key={verb}>
              <button
                aria-label={t('progress.verbsLabel', {
                  states: states
                    .map(
                      ({ state: mastery, tense }) =>
                        `${t(`conj.tenseTitle.${tense}`)} ${t(stateLabel[mastery])}`,
                    )
                    .join(', '),
                  verb: displayVerb(verb),
                })}
                className="flex min-h-13 w-full items-center px-4 text-left active:bg-surface-2 disabled:opacity-60"
                disabled={launch.pending}
                onClick={() => void launch.start(policies.verb(paths, verb))}
                type="button"
              >
                <span className="flex-1 text-body font-extrabold" lang="fr">
                  {displayVerb(verb)}
                </span>
                {states.map(({ state: mastery, tense }) => (
                  <span className="flex w-12 justify-center" key={tense}>
                    <span className={cn('size-4 rounded-full', dot[mastery])} />
                  </span>
                ))}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1">
        {legend.map(([mastery, label]) => (
          <li
            className="flex items-center gap-1.5 text-footnote font-semibold text-label-2"
            key={mastery}
          >
            <span aria-hidden className={cn('size-2.5 rounded-full', dot[mastery])} />
            {t(label)}
          </li>
        ))}
      </ul>
      <p className="px-1 text-footnote font-semibold text-label-2">{t('progress.verbsCopy')}</p>
    </Screen>
  )
}

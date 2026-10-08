/**
 * D8: the verb meadow, a second garden. One flower per ticked verb, sorted by group, three cards
 * a row; a dot per ticked tense; a butterfly on the verbs worked this week. Never a score.
 */
import type { MasteryState, MeadowVerb, VerbGroup } from '@little-tables/engine/schema'
import { cn, IconTile, ListGroup, ListRow, NavigationBar, Screen } from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'
import { HelpCircle, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { useApp } from '../app/app-context.js'
import { useMeadow } from '../app/derived.js'
import { useProfileState } from '../app/profile-state.js'
import { useLaunch } from '../child/launch.js'
import { policies } from '../data/practice.js'
import type { ProfileState } from '../data/schema.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { displayVerb } from '../session/format.js'
import { Butterfly } from './butterfly.js'
import { MeadowHelpSheet } from './meadow-help-sheet.js'
import { MeadowPlant } from './meadow-plant.js'

/** The same dots as « Mes verbes ». */
const tenseDot: Readonly<Record<MasteryState, string>> = {
  familiar: 'bg-sun',
  fluent: 'bg-leaf',
  learning: 'bg-sun-soft border-2 border-sun',
  unseen: 'bg-separator',
}

const stateLabel: Readonly<Record<MasteryState, MessageKey>> = {
  familiar: 'progress.legend.familiar',
  fluent: 'progress.legend.rooted',
  learning: 'progress.legend.growing',
  unseen: 'progress.legend.unseen',
}

const groups: ReadonlyArray<VerbGroup> = ['auxiliary', 'first', 'second', 'third']

export function MeadowScreen() {
  const state = useProfileState()
  if (state.data === undefined) return <Screen>{null}</Screen>
  return <Meadow state={state.data} />
}

function Meadow({ state }: Readonly<{ state: ProfileState }>) {
  const { activeProfile } = useApp()
  const { count, t } = useI18n()
  const navigate = useNavigate()
  const launch = useLaunch()
  const paths = activeProfile.learningPaths
  const meadow = useMeadow(state, paths)
  const [help, setHelp] = useState(false)

  return (
    <Screen
      top={
        <NavigationBar
          back={{ label: t('meadow.back'), onBack: () => void navigate({ to: '/garden' }) }}
          title={t('meadow.title')}
        />
      }
    >
      <p className="flex items-center gap-1.5 self-start rounded-full bg-surface px-3 py-1 text-footnote font-semibold text-label-2">
        <Sparkles aria-hidden className="size-3.5 text-sun" />
        {count('meadow.butterfliesWeek', meadow.butterfliesThisWeek)}
      </p>

      {groups.map((group) => {
        const verbs = meadow.verbs.filter((verb) => verb.group === group)
        if (verbs.length === 0) return null
        return (
          <section
            aria-label={t(`meadow.group.${group}`)}
            className="flex flex-col gap-3"
            key={group}
          >
            <header className="flex items-baseline justify-between px-1">
              <h2 className="text-title-3 font-extrabold" lang="fr">
                {t(`meadow.group.${group}`)}
              </h2>
              <span className="text-subhead font-semibold text-label-2">
                {count('meadow.verbsCount', verbs.length)}
              </span>
            </header>
            <ul className="grid grid-cols-3 gap-2">
              {verbs.map((verb) => (
                <li key={verb.verb}>
                  <MeadowCard
                    disabled={launch.pending}
                    onOpen={() => void launch.start(policies.verb(paths, verb.verb))}
                    verb={verb}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <ListGroup>
        <ListRow
          leading={
            <IconTile className="bg-sky">
              <HelpCircle aria-hidden />
            </IconTile>
          }
          onClick={() => setHelp(true)}
          title={t('meadow.help')}
          trailing="chevron"
        />
      </ListGroup>

      <MeadowHelpSheet onOpenChange={setHelp} open={help} />
    </Screen>
  )
}

function MeadowCard({
  disabled,
  onOpen,
  verb,
}: Readonly<{ disabled: boolean; onOpen: () => void; verb: MeadowVerb }>) {
  const { t } = useI18n()
  const seed = verb.stage === 'seed'
  const butterfly = verb.butterflyDayKeys.length > 0
  const states = verb.tenses
    .map(({ state, tense }) => `${t(`conj.tenseTitle.${tense}`)} ${t(stateLabel[state])}`)
    .join(', ')
  return (
    <button
      aria-label={[
        t('progress.verbsLabel', { states, verb: displayVerb(verb.verb) }),
        ...(butterfly ? [t('meadow.butterflyHere')] : []),
      ].join(', ')}
      className={cn(
        'relative flex w-full flex-col items-center gap-1.5 rounded-card px-2 pt-3 pb-3 active:opacity-80 disabled:opacity-60',
        seed ? 'bg-surface-2' : 'bg-surface',
      )}
      data-stage={verb.stage}
      disabled={disabled}
      onClick={onOpen}
      type="button"
    >
      <MeadowPlant className="h-24 w-auto" verb={verb} />
      {butterfly ? <Butterfly className="absolute top-2 right-0" /> : null}
      <span
        className={cn('text-body font-extrabold', seed ? 'text-label-2' : 'text-label')}
        lang="fr"
      >
        {displayVerb(verb.verb)}
      </span>
      <span aria-hidden className="flex gap-1">
        {verb.tenses.map(({ state, tense }) => (
          <span className={cn('size-2.5 rounded-full', tenseDot[state])} key={tense} />
        ))}
      </span>
    </button>
  )
}

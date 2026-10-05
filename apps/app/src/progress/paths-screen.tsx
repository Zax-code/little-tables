/** The learning paths: each opened skill and how rooted it is. Never a score. */
import { ListGroup, ListRow, NavigationBar, Screen } from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'

import { useApp } from '../app/app-context.js'
import { useLearningProgress } from '../app/derived.js'
import { useProfileState } from '../app/profile-state.js'
import { useLaunch } from '../child/launch.js'
import type { ProfileState } from '../data/schema.js'
import { policies } from '../data/practice.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { CountsBar } from './bars.js'

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

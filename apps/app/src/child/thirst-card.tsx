/** A7: when no ticked verb was watered for three days, one verb invites the child back. */
import type { LearningPathSettings } from '@little-tables/engine/schema'
import { Button } from '@little-tables/ui'
import { Droplets } from 'lucide-react'

import { useApp } from '../app/app-context.js'
import { useMeadow } from '../app/derived.js'
import { CharacterImage } from '../characters/character-image.js'
import { characterNames, characterOf } from '../characters/characters.js'
import { policies } from '../data/practice.js'
import type { ProfileState } from '../data/schema.js'
import { useI18n } from '../i18n/i18n.js'
import { displayVerb } from '../session/format.js'
import { useLaunch } from './launch.js'

/** Questions of a « Mes verbes » session (`policies.verb`). */
const verbQuestions = 8

export function ThirstCard({
  paths,
  state,
}: Readonly<{ paths: LearningPathSettings; state: ProfileState }>) {
  const { activeProfile } = useApp()
  const { t } = useI18n()
  const launch = useLaunch()
  const { thirst } = useMeadow(state, paths)
  if (thirst === null) return null
  const character = characterOf(activeProfile.avatarId)
  const verb = displayVerb(thirst.verb)
  return (
    <section className="flex items-center gap-3 rounded-card bg-sun-soft p-4">
      <CharacterImage
        alt={t('character.alt', { character: characterNames[character] })}
        character={character}
        className="h-20 w-auto shrink-0"
        eager
        scene="practiceEncourage"
      />
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <p className="text-footnote font-black tracking-wide text-sun uppercase">
          {t('today.thirstEyebrow')}
        </p>
        <h2 className="text-body font-extrabold" lang="fr">
          {thirst.daysSince === 0
            ? t('today.thirstNever', { verb })
            : t('today.thirstTitle', { days: thirst.daysSince, verb })}
        </h2>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Button
            className="bg-sun shadow-none"
            disabled={launch.pending}
            icon={<Droplets aria-hidden className="size-4" />}
            onClick={() => void launch.start(policies.verb(paths, thirst.verb))}
            size="sm"
          >
            {t('today.thirstWater', { verb })}
          </Button>
          <span className="text-footnote font-semibold text-label-2">
            {t('today.thirstQuestions', { count: verbQuestions })}
          </span>
        </div>
      </div>
    </section>
  )
}

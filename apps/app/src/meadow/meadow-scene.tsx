/**
 * D8: the meadow's corner, where the child's character waters the flowers of the verbs worked
 * today, or, before any, the first three verbs waiting for it.
 */
import type { MeadowVerb } from '@little-tables/engine/schema'

import { characterNames, type CharacterId } from '../characters/characters.js'
import { PlantWorld } from '../garden/garden-scene.js'
import { useI18n } from '../i18n/i18n.js'
import { displayVerb } from '../session/format.js'
import { MeadowPlant } from './meadow-plant.js'
import { verbsOfToday } from './meadow-verbs.js'

export function MeadowScene({
  character,
  todayKey,
  verbs,
}: Readonly<{ character: CharacterId; todayKey: string; verbs: ReadonlyArray<MeadowVerb> }>) {
  const { count, t } = useI18n()
  const shown = verbsOfToday(verbs, todayKey)
  if (shown.verbs.length === 0) return null
  const label = t(shown.today ? 'meadow.sceneToday' : 'meadow.sceneToWater')
  return (
    <PlantWorld
      caretaker={t('garden.caretaker', { character: characterNames[character] })}
      character={character}
      className="shrink-0 bg-[linear-gradient(180deg,var(--lt-sun-soft),var(--lt-leaf-soft))]"
      corners={[
        {
          caption: (
            <>
              <span>{label}</span>
              <span>{count('meadow.verbsCount', shown.verbs.length)}</span>
            </>
          ),
          id: 'meadow',
          label,
          pots: shown.verbs.map((verb) => ({
            id: verb.verb,
            render: (className: string) => (
              <MeadowPlant className={className} label={displayVerb(verb.verb)} verb={verb} />
            ),
            watered: true,
          })),
        },
      ]}
      soil="bg-leaf-soft"
    />
  )
}

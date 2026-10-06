/** D3: every flower found so far, chapter by chapter; the others stay a mystery. */
import { cn, NavigationBar, Screen } from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'

import { useProfileState } from '../app/profile-state.js'
import { useGarden } from '../app/derived.js'
import type { ProfileState } from '../data/schema.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { Plant } from './plant.js'

export function HerbariumScreen() {
  const state = useProfileState()
  if (state.data === undefined) return <Screen>{null}</Screen>
  return <Herbarium state={state.data} />
}

function Herbarium({ state }: Readonly<{ state: ProfileState }>) {
  const { count, t } = useI18n()
  const navigate = useNavigate()
  const garden = useGarden(state)
  return (
    <Screen
      top={
        <NavigationBar
          back={{ label: t('garden.back'), onBack: () => void navigate({ to: '/garden' }) }}
          title={t('herbarium.title')}
        />
      }
    >
      <p className="shrink-0 px-1 text-subhead font-semibold text-label-2">
        {count('herbarium.count', garden.collection.collectedCount, {
          total: garden.collection.totalCount,
        })}
      </p>
      {garden.chapters.map((chapter) => (
        <section
          className="flex shrink-0 flex-col gap-2 last:pb-[env(safe-area-inset-bottom)]"
          key={chapter.id}
        >
          <h2 className="px-1 text-title-3 font-extrabold">
            {t(`chapter.${chapter.id}` as MessageKey)}
          </h2>
          <ul className="grid grid-cols-3 gap-2">
            {chapter.plants.map((plant) => {
              const known = plant.collected || plant.stage === 'mature' || plant.stage === 'growing'
              const bloomed = plant.collected || plant.stage === 'mature'
              return (
                <li
                  className={cn(
                    'flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-card p-2 text-center',
                    known ? 'bg-surface' : 'bg-surface-2',
                  )}
                  key={plant.id}
                >
                  {known ? (
                    <>
                      <Plant
                        className="h-20 w-auto"
                        plant={bloomed ? { ...plant, stage: 'mature' } : plant}
                      />
                      <span className="text-footnote leading-tight font-extrabold">
                        {t(`plant.${plant.id}` as MessageKey)}
                      </span>
                      <span
                        className={cn('text-caption font-bold', bloomed ? 'text-leaf' : 'text-sun')}
                      >
                        {t(bloomed ? 'herbarium.inBloom' : 'herbarium.growing')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock aria-hidden className="size-6 text-label-3" />
                      <span className="text-caption font-bold text-label-3">
                        {t('herbarium.mystery')}
                      </span>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </Screen>
  )
}

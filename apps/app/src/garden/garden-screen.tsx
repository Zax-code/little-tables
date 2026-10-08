/** D2: the garden, one corner per page of one continuous world, with the herbarium and how it grows (D3, D4). */
import { Button, cn, IconTile, ListGroup, ListRow, Screen, Sheet } from '@little-tables/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BookOpen, Bug, Droplets, Flower2, Heart, HelpCircle, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'

import { useApp } from '../app/app-context.js'
import { profileStateKey, useProfileState } from '../app/profile-state.js'
import { todayKey, useGarden, useMeadow } from '../app/derived.js'
import { characterOf } from '../characters/characters.js'
import { ChildTabBar } from '../child/chrome.js'
import { LocalStore } from '../data/local-store.js'
import type { ProfileState } from '../data/schema.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { Effect } from 'effect'
import { GardenWorld } from './garden-scene.js'

const ambient = [
  'ambient.bird',
  'ambient.breeze',
  'ambient.butterfly',
  'ambient.dew',
  'ambient.ladybug',
  'ambient.rain',
  'ambient.rainbow',
  'ambient.snail',
  'ambient.sunbeam',
  'ambient.wateringCan',
] as const satisfies ReadonlyArray<MessageKey>

/** The same little scene all day long, a new one the next day. */
const ambientOfDay = (dayKey: string) => {
  let sum = 0
  for (let index = 0; index < dayKey.length; index += 1) sum += dayKey.charCodeAt(index)
  return ambient[sum % ambient.length] ?? 'ambient.ladybug'
}

export function GardenScreen() {
  const state = useProfileState()
  if (state.data === undefined) return <Screen bottom={<ChildTabBar />}>{null}</Screen>
  return <Garden state={state.data} />
}

function Garden({ state }: Readonly<{ state: ProfileState }>) {
  const { activeProfile, runtime } = useApp()
  const { count, t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const garden = useGarden(state)
  const meadow = useMeadow(state, activeProfile.learningPaths)
  const butterflies = meadow.butterfliesThisWeek
  const character = characterOf(activeProfile.avatarId)
  const pages = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(() =>
    Math.max(
      0,
      garden.chapters.findIndex((chapter) => chapter.stage === 'growing'),
    ),
  )
  const [rules, setRules] = useState(() => !state.gardenCollection.introductionSeen)
  const plant = garden.nextStep?.plant ?? garden.featuredPlant

  const opened = useRef(false)
  /** Opens on the corner that is growing; afterwards the child scrolls freely. */
  const attach = (element: HTMLDivElement | null) => {
    pages.current = element
    if (element === null || opened.current) return
    opened.current = true
    element.scrollLeft = page * element.clientWidth
  }

  const closeRules = (open: boolean) => {
    setRules(open)
    if (open || state.gardenCollection.introductionSeen) return
    void runtime
      .runPromise(
        Effect.flatMap(LocalStore, (store) =>
          store.update(activeProfile.id, (current) => ({
            state: {
              ...current,
              gardenCollection: { ...current.gardenCollection, introductionSeen: true },
            },
          })),
        ),
      )
      .then((next) => queryClient.setQueryData(profileStateKey(activeProfile.id), next))
  }

  return (
    <Screen bottom={<ChildTabBar />}>
      <header className="flex flex-col gap-2 px-1 pt-4">
        <h1 className="text-large-title font-extrabold">{t('garden.title')}</h1>
        <p className="flex items-center gap-1.5 self-start rounded-full bg-surface px-3 py-1 text-footnote font-semibold text-label-2">
          {butterflies > 0 ? (
            <>
              <Sparkles aria-hidden className="size-3.5 text-sun" />
              {t('garden.momentButterfly')}
            </>
          ) : (
            <>
              <Bug aria-hidden className="size-3.5 text-danger" />
              {t(ambientOfDay(todayKey()))}
            </>
          )}
        </p>
      </header>

      <section aria-label={t('garden.pages')} className="flex flex-col gap-2">
        <GardenWorld
          chapters={garden.chapters}
          character={character}
          initialChapter={page}
          onScroll={(event) => {
            const element = event.currentTarget
            setPage(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)))
          }}
          scrollerRef={attach}
        />
        <div className="flex justify-center gap-1.5">
          {garden.chapters.map((chapter, index) => (
            <button
              aria-current={index === page}
              aria-label={t('garden.pageLabel', { name: t(`chapter.${chapter.id}` as MessageKey) })}
              className="flex size-6 items-center justify-center"
              key={chapter.id}
              onClick={() => {
                const element = pages.current
                element?.scrollTo({ left: index * element.clientWidth })
                setPage(index)
              }}
              type="button"
            >
              <span
                className={cn('size-2 rounded-full', index === page ? 'bg-tint' : 'bg-label-3')}
              />
            </button>
          ))}
        </div>
      </section>

      <ListGroup>
        {meadow.verbs.length === 0 ? null : (
          <ListRow
            detail={count('garden.meadowDetail', butterflies)}
            leading={
              <IconTile className="bg-sun">
                <Flower2 aria-hidden />
              </IconTile>
            }
            onClick={() => void navigate({ to: '/garden/meadow' })}
            title={t('garden.meadowRow')}
            trailing="chevron"
          />
        )}
        {plant === null ? null : (
          <ListRow
            detail={`${Math.min(plant.bloomsEarned, plant.bloomsRequired)}/${plant.bloomsRequired}`}
            leading={
              <IconTile className="bg-leaf">
                <Droplets aria-hidden />
              </IconTile>
            }
            title={t(`plant.${plant.id}` as MessageKey)}
          />
        )}
        <ListRow
          detail={count('garden.flowers', garden.collection.collectedCount)}
          leading={
            <IconTile className="bg-tint">
              <BookOpen aria-hidden />
            </IconTile>
          }
          onClick={() => void navigate({ to: '/garden/herbarium' })}
          title={t('garden.herbarium')}
          trailing="chevron"
        />
        <ListRow
          leading={
            <IconTile className="bg-sky">
              <HelpCircle aria-hidden />
            </IconTile>
          }
          onClick={() => setRules(true)}
          title={t('garden.howItGrows')}
          trailing="chevron"
        />
      </ListGroup>

      <RulesSheet onOpenChange={closeRules} open={rules} />
    </Screen>
  )
}

const rules = [
  { copy: 'rules.dailyCopy', icon: Droplets, tile: 'bg-sky', title: 'rules.daily' },
  { copy: 'rules.flowerCopy', icon: Flower2, tile: 'bg-tint', title: 'rules.flower' },
  { copy: 'rules.specialCopy', icon: Sparkles, tile: 'bg-sun', title: 'rules.special' },
  { copy: 'rules.restCopy', icon: Heart, tile: 'bg-leaf', title: 'rules.rest' },
] as const

/** D4: how the garden grows, shown once on the first visit and on request. */
function RulesSheet({
  onOpenChange,
  open,
}: Readonly<{ onOpenChange: (open: boolean) => void; open: boolean }>) {
  const { t } = useI18n()
  return (
    <Sheet onOpenChange={onOpenChange} open={open} title={t('rules.title')}>
      <ul className="flex flex-col gap-4">
        {rules.map(({ copy, icon: Icon, tile, title }) => (
          <li className="flex items-start gap-3" key={title}>
            <IconTile className={tile}>
              <Icon aria-hidden />
            </IconTile>
            <div className="flex flex-col">
              <h3 className="text-body font-extrabold">{t(title)}</h3>
              <p className="text-subhead text-label-2">{t(copy)}</p>
            </div>
          </li>
        ))}
      </ul>
      <Button onClick={() => onOpenChange(false)} variant="tinted" width="full">
        {t('rules.done')}
      </Button>
    </Sheet>
  )
}

/** A1 to A4: what to do today, the plant in progress and the week in bloom. */
import type { GardenPlantProgress } from '@little-tables/engine/schema'
import { Button, ProgressBar, ProgressRing, Screen, WeekStrip } from '@little-tables/ui'
import { Droplets, Play, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { useApp, useProfileState } from '../app/app-context.js'
import { useDailyQuestionCount, useGarden, useRhythm } from '../app/derived.js'
import { CharacterImage } from '../characters/character-image.js'
import { characterNames, characterOf } from '../characters/characters.js'
import type { ProfileState } from '../data/schema.js'
import { policies } from '../data/practice.js'
import { Plant } from '../garden/plant.js'
import { useI18n, type MessageKey } from '../i18n/i18n.js'
import { ChildTabBar, ChildTopBar } from './chrome.js'
import { useLaunch } from './launch.js'
import { OtherSessionsSheet } from './other-sessions-sheet.js'
import { weekDays } from './week.js'

export function TodayScreen() {
  const state = useProfileState()
  if (state.data === undefined) return <Screen top={<ChildTopBar />}>{null}</Screen>
  return <Today state={state.data} />
}

function Today({ state }: Readonly<{ state: ProfileState }>) {
  const { activeProfile } = useApp()
  const translator = useI18n()
  const { count, t } = translator
  const rhythm = useRhythm(state)
  const garden = useGarden(state)
  const [openedAt] = useState(() => Date.now())
  const questions = useDailyQuestionCount(state, activeProfile.learningPaths, openedAt)
  const launch = useLaunch()
  const [choosing, setChoosing] = useState(false)
  const name = activeProfile.name
  const session = state.activeSession
  const firstVisit = state.snapshot.processedEventIds.length === 0 && state.completedSessions === 0

  const heading =
    session !== null
      ? t('today.resumeTitle')
      : rhythm.comeback !== 'none'
        ? t('today.comebackTitle', { name })
        : rhythm.dailyWateringDone
          ? t('today.doneTitle', { name })
          : firstVisit
            ? t('today.firstTitle', { name })
            : t('today.helloTitle', { name })
  const copyKey: MessageKey =
    session !== null
      ? session.kind === 'daily-watering'
        ? 'today.resumeDailyCopy'
        : 'today.resumeCopy'
      : rhythm.comeback === 'long'
        ? 'today.comebackLongCopy'
        : rhythm.comeback === 'short'
          ? 'today.comebackShortCopy'
          : rhythm.dailyWateringDone
            ? 'today.doneCopy'
            : firstVisit
              ? 'today.firstCopy'
              : 'today.helloCopy'

  const minutes = Math.max(1, Math.ceil(questions / 5))
  const primary =
    session !== null ? (
      <Button
        icon={<Play aria-hidden className="size-5" />}
        onClick={() => void launch.resume()}
        size="lg"
        width="full"
      >
        {t('today.resume')}
      </Button>
    ) : rhythm.dailyWateringDone ? (
      <Button
        disabled={launch.pending}
        icon={<Sparkles aria-hidden className="size-5" />}
        onClick={() => void launch.start(policies.quick(activeProfile.learningPaths))}
        size="lg"
        width="full"
      >
        {t('today.bonus')}
      </Button>
    ) : (
      <Button
        disabled={launch.pending}
        icon={<Droplets aria-hidden className="size-5" />}
        onClick={() => void launch.start(policies.daily(activeProfile.learningPaths))}
        size="lg"
        width="full"
      >
        {t('today.water')}
      </Button>
    )

  return (
    <Screen
      bottom={
        <div className="flex flex-col gap-2.5">
          {session === null ? (
            <p className="text-center text-footnote font-semibold text-label-2">
              {rhythm.dailyWateringDone
                ? t('today.bonusCaption')
                : count('today.questions', questions, { minutes })}
            </p>
          ) : null}
          {primary}
          {session === null ? (
            <Button onClick={() => setChoosing(true)} variant="tinted" width="full">
              {t('today.otherSessions')}
            </Button>
          ) : null}
          <div className="pt-1">
            <ChildTabBar />
          </div>
        </div>
      }
      top={<ChildTopBar />}
    >
      <header className="flex flex-col gap-1 px-1 pt-2">
        <h1 className="text-large-title font-extrabold text-balance">{heading}</h1>
        <p className="text-callout text-label-2 text-pretty">{t(copyKey)}</p>
      </header>
      {session !== null ? (
        <section className="flex items-center gap-4 rounded-card bg-surface p-4">
          <ProgressRing
            label={t('today.sessionProgress', {
              current: session.currentIndex,
              total: session.questions.length,
            })}
            value={session.currentIndex / session.questions.length}
          >
            {session.currentIndex}/{session.questions.length}
          </ProgressRing>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-body font-extrabold">
              {t(session.kind === 'daily-watering' ? 'today.dailyWatering' : 'today.littleSession')}
            </h2>
            <p className="text-subhead text-label-2">
              {count('today.questionsLeft', session.questions.length - session.currentIndex)}
            </p>
          </div>
        </section>
      ) : firstVisit && !rhythm.dailyWateringDone ? (
        <FirstVisitCard />
      ) : (
        <PlantCard
          allBlooming={garden.collection.complete}
          done={rhythm.dailyWateringDone}
          plant={garden.nextStep?.plant ?? garden.featuredPlant}
        />
      )}
      <WeekStrip
        days={weekDays(rhythm, translator)}
        status={
          rhythm.visitsUntilBloomingWeek > 0
            ? count('week.daysToGo', rhythm.visitsUntilBloomingWeek)
            : t('week.inBloom')
        }
        title={t('week.title')}
      />
      <OtherSessionsSheet onOpenChange={setChoosing} open={choosing} state={state} />
    </Screen>
  )
}

function FirstVisitCard() {
  const { activeProfile } = useApp()
  const { t } = useI18n()
  const character = characterOf(activeProfile.avatarId)
  return (
    <section className="flex items-center gap-3 rounded-card bg-surface p-4">
      <CharacterImage
        alt={t('character.alt', { character: characterNames[character] })}
        character={character}
        className="h-24 w-auto shrink-0"
        eager
        scene="home"
      />
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-extrabold">{t('today.gardenGrows')}</h2>
        <p className="text-subhead text-label-2">{t('today.gardenGrowsCopy')}</p>
      </div>
    </section>
  )
}

type PlantCardProps = Readonly<{
  allBlooming: boolean
  done: boolean
  plant: GardenPlantProgress | null
}>

function PlantCard({ allBlooming, done, plant }: PlantCardProps) {
  const { count, t } = useI18n()
  if (plant === null || allBlooming) {
    return (
      <section className="rounded-card bg-leaf-soft p-4">
        <h2 className="text-body font-extrabold text-leaf">{t('today.allBlooming')}</h2>
      </section>
    )
  }
  const name = t(`plant.${plant.id}` as MessageKey)
  const earned = Math.min(plant.bloomsEarned, plant.bloomsRequired)
  const remaining = plant.bloomsRequired - earned
  return (
    <section className="flex items-center gap-3 rounded-card bg-leaf-soft p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-caption font-black tracking-wider text-leaf uppercase">
          {t('today.plantInProgress')}
        </p>
        <h2 className="text-title-3 font-extrabold">{name}</h2>
        <p className="text-footnote font-semibold text-label-2">
          {count('today.waterings', earned, { total: plant.bloomsRequired })}
          {done && remaining > 0 ? ` · ${count('today.untilBloom', remaining)}` : ''}
        </p>
        <ProgressBar
          className="mt-1"
          label={count('today.waterings', earned, { total: plant.bloomsRequired })}
          segments={plant.bloomsRequired}
          value={earned}
        />
      </div>
      <Plant
        className="h-24 w-auto shrink-0"
        plant={{ ...plant, stage: earned > 0 ? 'growing' : 'dormant' }}
      />
    </section>
  )
}

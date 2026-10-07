/** D1: the end of a session — the answer, the watering earned and one thing that went well. */
import type { GardenProgress } from '@little-tables/engine/schema'
import { Badge, Button, ProgressBar } from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'
import { Droplets, Sparkles, Sprout } from 'lucide-react'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { useApp } from '../app/app-context.js'
import { useProfileState } from '../app/profile-state.js'
import { useGarden } from '../app/derived.js'
import { characterNames, characterOf } from '../characters/characters.js'
import { Sprite } from '../characters/sprite.js'
import type { ProfileState, SessionCompletion } from '../data/schema.js'
import { Plant } from '../garden/plant.js'
import { InstallCard } from '../install.js'
import { isInstalled } from '../install-prompt.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey, Translator } from '../i18n/translator.js'
import { formatAnswer, formatNumber } from '../session/format.js'
import { insightCopy } from './insight.js'

export function CelebrationScreen() {
  const state = useProfileState()
  const navigate = useNavigate()
  const completion = state.data?.lastCompletion ?? null
  useEffect(() => {
    if (state.data !== undefined && completion === null) void navigate({ replace: true, to: '/' })
  }, [completion, navigate, state.data])
  if (state.data === undefined || completion === null) return <div className="h-dvh bg-bg" />
  return <Celebration completion={completion} state={state.data} />
}

const petals = [
  { left: '12%', top: '14%', tone: 'var(--garden-bloom-pink)' },
  { left: '82%', top: '18%', tone: 'var(--garden-bloom-gold)' },
  { left: '8%', top: '44%', tone: 'var(--garden-leaf-light)' },
  { left: '86%', top: '40%', tone: 'var(--garden-bloom-lavender)' },
  { left: '20%', top: '30%', tone: 'var(--garden-bloom-gold)' },
  { left: '74%', top: '52%', tone: 'var(--garden-bloom-pink)' },
] as const

function Petals() {
  const reduced = useReducedMotion() === true
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {petals.map((petal, index) => (
        <m.svg
          animate={reduced ? {} : { rotate: [0, 12, -8, 0], y: [0, -6, 4, 0] }}
          className="absolute size-6"
          key={index}
          style={{ left: petal.left, top: petal.top }}
          transition={{ delay: index * 0.3, duration: 5, repeat: Number.POSITIVE_INFINITY }}
          viewBox="0 0 24 24"
        >
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse
              cx="12"
              cy="6"
              fill={petal.tone}
              key={angle}
              rx="4"
              ry="5.5"
              transform={`rotate(${angle} 12 12)`}
            />
          ))}
          <circle cx="12" cy="12" fill="var(--garden-center-yellow)" r="3" />
        </m.svg>
      ))}
    </div>
  )
}

function rewardLine(garden: GardenProgress, t: Translator) {
  const plant = garden.featuredPlant
  if (plant?.stage === 'mature') {
    return t.t('celebration.rewardMature', { plant: t.t(`plant.${plant.id}` as MessageKey) })
  }
  const next = garden.nextStep
  if (next === null) return t.t('celebration.rewardAllBlooming')
  const remaining =
    next.plant.bloomsRequired - Math.min(next.plant.bloomsEarned, next.plant.bloomsRequired)
  if (remaining === 0 && next.fluentFactsRemaining > 0) {
    return t.t('celebration.rewardMastery', { count: next.fluentFactsRemaining })
  }
  return t.count('celebration.rewardGrowing', remaining)
}

function Celebration({
  completion,
  state,
}: Readonly<{ completion: SessionCompletion; state: ProfileState }>) {
  const { activeProfile, device } = useApp()
  const [offerInstall, setOfferInstall] = useState(
    () =>
      state.completedSessions === 1 && !isInstalled() && !device.seenCards().includes('install'),
  )
  const translator = useI18n()
  const { t } = translator
  const navigate = useNavigate()
  const garden = useGarden(state)
  const character = characterOf(activeProfile.avatarId)
  const plant = garden.featuredPlant ?? garden.nextStep?.plant ?? null
  const perfect = completion.correctAnswers === completion.totalAnswers
  const answer =
    typeof completion.finalExpected === 'number'
      ? formatNumber(completion.finalExpected, translator.language)
      : formatAnswer(completion.finalExpected, translator.language)
  const title = completion.finalCorrect
    ? t('celebration.yesTitle', { answer })
    : t('celebration.doneTitle')
  const insight =
    completion.learningInsight === null ? null : insightCopy(completion.learningInsight, translator)

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[linear-gradient(180deg,var(--lt-tint-soft),var(--lt-bg)_55%)] safe-top">
      <Petals />
      <main className="relative flex flex-1 flex-col items-center gap-2 overflow-y-auto px-4 pt-10 text-center">
        <h1 className="text-large-title font-extrabold">{title}</h1>
        <p className="text-callout font-semibold text-label-2">
          {perfect ? t('celebration.perfect') : (insight ?? '')}
        </p>
        <Sprite
          character={character}
          className="my-2 w-56 max-w-[70vw]"
          label={t('character.alt', { character: characterNames[character] })}
          motion="celebration"
        />
        <section className="flex w-full max-w-md flex-col gap-2 rounded-card bg-surface p-4 text-left shadow-[0_4px_16px_var(--lt-shadow)]">
          {completion.gardenBloomEarned && plant !== null ? (
            <div className="flex items-center gap-3">
              <Plant className="h-20 w-auto shrink-0" plant={plant} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Badge tone="leaf">
                  <Droplets aria-hidden className="size-3.5" />
                  {t('celebration.oneWatering')}
                </Badge>
                <h2 className="text-body font-extrabold">{t(`plant.${plant.id}` as MessageKey)}</h2>
                <ProgressBar
                  label={translator.count(
                    'today.waterings',
                    Math.min(plant.bloomsEarned, plant.bloomsRequired),
                    {
                      total: plant.bloomsRequired,
                    },
                  )}
                  segments={plant.bloomsRequired}
                  value={Math.min(plant.bloomsEarned, plant.bloomsRequired)}
                />
                <p className="text-footnote font-semibold text-label-2">
                  {rewardLine(garden, translator)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-subhead font-semibold text-label-2">{t('celebration.extraCopy')}</p>
          )}
          {insight === null || !perfect ? null : (
            <p className="flex items-start gap-1.5 text-footnote font-bold text-tint">
              <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {insight}
            </p>
          )}
        </section>
        {offerInstall ? (
          <div className="w-full max-w-md">
            <InstallCard
              onDismiss={() => {
                device.markCardSeen('install')
                setOfferInstall(false)
              }}
            />
          </div>
        ) : null}
      </main>
      <div className="relative px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          autoFocus
          icon={<Sprout aria-hidden className="size-5" />}
          onClick={() => void navigate({ to: '/garden' })}
          size="lg"
          width="full"
        >
          {t('celebration.seeGarden')}
        </Button>
      </div>
    </div>
  )
}

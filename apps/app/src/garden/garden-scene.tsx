/**
 * The garden as one continuous world (mockup D2): its corners side by side, three pots evenly
 * spaced in each, and the child's character walking from any watered plant to any other, across
 * corners, while the child swipes freely from one corner to the next.
 */
import type { GardenProgress } from '@little-tables/engine/schema'
import { cn } from '@little-tables/ui'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState, type Ref, type UIEventHandler } from 'react'

import { characterNames, type CharacterId } from '../characters/characters.js'
import { Sprite } from '../characters/sprite.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { Plant } from './plant.js'

type Chapter = GardenProgress['chapters'][number]

/** Centres of the three pots, in percent of a corner's width: equal gaps on both sides. */
const potCentres = [20, 50, 80] as const

const WATER_MS = 5200
/** Walking from one pot to the next takes this long; farther pots take longer. */
const WALK_PER_POT_MS = 1600

type Stop = Readonly<{ chapter: number; position: number }>

/** Where a pot stands, in percent of the whole world's width. */
const worldX = ({ chapter, position }: Stop, chapters: number) =>
  (chapter * 100 + (potCentres[position] ?? 50)) / chapters

/** The next plant to water: another watered plant, chosen at random, never the same twice. */
const nextStop = (stops: ReadonlyArray<Stop>, current: number) => {
  if (stops.length < 2) return current
  const other = Math.floor(Math.random() * (stops.length - 1))
  return other >= current ? other + 1 : other
}

type GardenWorldProps = Readonly<{
  chapters: ReadonlyArray<Chapter>
  character: CharacterId
  /** The corner the world opens on. */
  initialChapter: number
  onScroll: UIEventHandler<HTMLDivElement>
  scrollerRef: Ref<HTMLDivElement>
}>

export function GardenWorld({
  chapters,
  character,
  initialChapter,
  onScroll,
  scrollerRef,
}: GardenWorldProps) {
  const { t } = useI18n()
  const reduced = useReducedMotion() === true
  const count = chapters.length
  const stops: ReadonlyArray<Stop> = chapters.flatMap((chapter, index) =>
    chapter.plants.flatMap((plant, position) =>
      plant.stage === 'locked' ? [] : [{ chapter: index, position }],
    ),
  )
  // Starts by a plant of the corner the garden opens on.
  const [stop, setStop] = useState(() =>
    Math.max(
      0,
      stops.findIndex(({ chapter }) => chapter === initialChapter),
    ),
  )
  const [walk, setWalk] = useState<Readonly<{ ms: number; towardsLeft: boolean }> | null>(null)
  const target = stops[stop]

  useEffect(() => {
    if (reduced || stops.length < 2) return
    const timer = window.setTimeout(
      () => {
        if (walk !== null) {
          setWalk(null)
          return
        }
        const from = stops[stop]
        const next = nextStop(stops, stop)
        const to = stops[next]
        if (from === undefined || to === undefined) return
        // In pot gaps: one corner is about three gaps wide.
        const distance = Math.abs(worldX(to, count) - worldX(from, count)) / (30 / count)
        setWalk({
          ms: Math.min(6000, Math.max(1, distance) * WALK_PER_POT_MS),
          towardsLeft: worldX(to, count) < worldX(from, count),
        })
        setStop(next)
      },
      walk === null ? WATER_MS : walk.ms,
    )
    return () => window.clearTimeout(timer)
  }, [count, reduced, stop, stops, walk])

  return (
    <div
      className="relative aspect-[4/3] overflow-x-auto overflow-y-hidden rounded-card snap-x snap-mandatory scroll-smooth [scrollbar-width:none]"
      onScroll={onScroll}
      ref={scrollerRef}
    >
      <div className="relative flex h-full bg-surface" style={{ width: `${count * 100}%` }}>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[24%] bg-soil" />
        {chapters.map((chapter, index) => {
          const name = t(`chapter.${chapter.id}` as MessageKey)
          return (
            <figure
              aria-label={t('chapter.label', { name, number: index + 1 })}
              className="relative h-full shrink-0 snap-center"
              key={chapter.id}
              style={{ width: `${100 / count}%` }}
            >
              <figcaption className="absolute inset-x-0 top-0 z-30 flex justify-between px-4 pt-3 text-footnote font-extrabold text-label-2">
                <span>{t('chapter.label', { name, number: index + 1 })}</span>
                <span aria-hidden>
                  {index + 1}/{count}
                </span>
              </figcaption>
              <ol className="absolute inset-x-0 bottom-[8%] z-20 grid grid-cols-3">
                {chapter.plants.map((plant, position) => (
                  <li className="flex justify-center" key={plant.id}>
                    <Plant
                      className={cn(
                        'h-auto w-[80%]',
                        walk === null &&
                          target?.chapter === index &&
                          target.position === position &&
                          !reduced &&
                          'plant-drink',
                      )}
                      label={
                        plant.stage === 'locked'
                          ? t('herbarium.mystery')
                          : `${t(`plant.${plant.id}` as MessageKey)}, ${t(plant.stage === 'mature' ? 'herbarium.inBloom' : 'herbarium.growing')}`
                      }
                      plant={plant}
                    />
                  </li>
                ))}
              </ol>
              {chapter.stage === 'locked' ? (
                <p className="absolute inset-x-0 top-1/3 z-30 text-center text-subhead font-extrabold text-label-2">
                  {t('garden.lockedChapter')}
                </p>
              ) : null}
            </figure>
          )
        })}
        {target === undefined ? null : (
          // The track spans the whole world, so moving it by a percentage of its width moves the
          // character by the same share of the world, with a transform rather than a layout change.
          <m.div
            animate={{ x: `${worldX(target, count)}%` }}
            className="pointer-events-none absolute inset-x-0 bottom-[16%] z-10"
            initial={false}
            transition={
              reduced || walk === null
                ? { duration: 0 }
                : { duration: walk.ms / 1000, ease: 'easeInOut' }
            }
          >
            <div className="-translate-x-[62%]" style={{ width: `${46 / count}%` }}>
              <Sprite
                character={character}
                flipped={walk?.towardsLeft === true}
                label={t('garden.caretaker', { character: characterNames[character] })}
                motion={walk === null ? 'water' : 'walk'}
              />
            </div>
          </m.div>
        )}
      </div>
    </div>
  )
}

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

/** The character's sprite is this share of a corner's width. */
const SPRITE_WIDTH = 0.46
/** In the watering frames, the water falls this far across the sprite (from its left edge). */
const POUR_POINT = 0.8
/**
 * One walk cycle (`.sprite-walk` in styles.css) lasts 0.58 s and its two steps carry the body
 * about half the sprite's width. Moving at that speed keeps the feet planted on the ground: the
 * character neither slides nor walks on the spot.
 */
const WALK_CYCLE_MS = 580
const STRIDE_PER_CYCLE = 0.5
/** Corners per millisecond. */
const WALK_SPEED = (STRIDE_PER_CYCLE * SPRITE_WIDTH) / WALK_CYCLE_MS

type Stop = Readonly<{ chapter: number; position: number }>

/** Where a pot stands, in percent of the whole world's width. */
const worldX = ({ chapter, position }: Stop, chapters: number) =>
  (chapter * 100 + (potCentres[position] ?? 50)) / chapters

/**
 * The character waters a pot of a corner's left half from its right, facing left, as in the
 * previous app: it stays inside that corner instead of standing in the one before.
 */
const facesLeft = ({ position }: Stop) => (potCentres[position] ?? 50) < 50

/** Share of the sprite's width between its left edge and the point over the pot. */
const pourShare = (stop: Stop) => (facesLeft(stop) ? 1 - POUR_POINT : POUR_POINT)

/** Where the character's left edge stands while watering, in percent of the world's width. */
const standX = (stop: Stop, chapters: number) =>
  worldX(stop, chapters) - (pourShare(stop) * SPRITE_WIDTH * 100) / chapters

/** The next plant to water: another watered plant, chosen at random, never the same twice. */
const nextStop = (stops: ReadonlyArray<Stop>, current: number) => {
  if (stops.length < 2) return current
  const other = Math.floor(Math.random() * (stops.length - 1))
  return other >= current ? other + 1 : other
}

type Walk = Readonly<{ ms: number; towardsLeft: boolean }>

/** A steady pace, as fast as the steps (easing would make the feet slide); no motion at rest. */
const motionOf = (walk: Walk | null, reduced: boolean) =>
  reduced || walk === null ? { duration: 0 } : { duration: walk.ms / 1000, ease: 'linear' as const }

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
  const [walk, setWalk] = useState<Walk | null>(null)
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
        // In corners: the world is `count` corners wide.
        const distance = (Math.abs(standX(to, count) - standX(from, count)) * count) / 100
        setWalk({
          ms: Math.round(distance / WALK_SPEED),
          towardsLeft: standX(to, count) < standX(from, count),
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
            transition={motionOf(walk, reduced)}
          >
            {/* The pour point, not the sprite's middle, stands over the pot's soil. */}
            <m.div
              animate={{ x: `-${pourShare(target) * 100}%` }}
              initial={false}
              style={{ width: `${(SPRITE_WIDTH * 100) / count}%` }}
              transition={motionOf(walk, reduced)}
            >
              <Sprite
                character={character}
                flipped={walk === null ? facesLeft(target) : walk.towardsLeft}
                label={t('garden.caretaker', { character: characterNames[character] })}
                motion={walk === null ? 'water' : 'walk'}
              />
            </m.div>
          </m.div>
        )}
      </div>
    </div>
  )
}

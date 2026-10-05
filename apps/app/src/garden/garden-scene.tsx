/**
 * One corner of the garden (mockup D2): three pots evenly spaced on the ground, the child's
 * character walking behind the row and watering one plant at a time.
 */
import type { GardenProgress } from '@little-tables/engine/schema'
import { cn } from '@little-tables/ui'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { characterNames, type CharacterId } from '../characters/characters.js'
import { Sprite } from '../characters/sprite.js'
import { useI18n } from '../i18n/i18n.js'
import type { MessageKey } from '../i18n/translator.js'
import { Plant } from './plant.js'

type Chapter = GardenProgress['chapters'][number]

/** Centres of the three pots, in percent of the scene's width: equal gaps on both sides. */
const potCentres = [20, 50, 80] as const

const WATER_MS = 5200
const WALK_MS = 1600

type GardenSceneProps = Readonly<{
  chapter: Chapter
  character: CharacterId
  index: number
  total: number
}>

export function GardenScene({ chapter, character, index, total }: GardenSceneProps) {
  const { t } = useI18n()
  const reduced = useReducedMotion() === true
  const watered = chapter.plants.flatMap((plant, position) =>
    plant.stage === 'locked' ? [] : [{ position }],
  )
  const stops = watered.length === 0 ? [{ position: 1 }] : watered
  const [stop, setStop] = useState(0)
  const [walking, setWalking] = useState(false)
  const target = stops[stop % stops.length]?.position ?? 1

  useEffect(() => {
    if (reduced || stops.length < 2) return
    const timer = window.setTimeout(
      () => {
        if (walking) {
          setWalking(false)
        } else {
          setWalking(true)
          setStop((current) => (current + 1) % stops.length)
        }
      },
      walking ? WALK_MS : WATER_MS,
    )
    return () => window.clearTimeout(timer)
  }, [reduced, stops.length, walking])

  const name = t(`chapter.${chapter.id}` as MessageKey)
  const locked = chapter.stage === 'locked'
  return (
    <figure
      aria-label={t('chapter.label', { name, number: index + 1 })}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-card bg-[linear-gradient(180deg,var(--lt-sky-soft),var(--lt-surface)_70%)]"
    >
      <figcaption className="absolute inset-x-0 top-0 z-30 flex justify-between px-4 pt-3 text-footnote font-extrabold text-label-2">
        <span>{t('chapter.label', { name, number: index + 1 })}</span>
        <span aria-hidden>
          {index + 1}/{total}
        </span>
      </figcaption>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[24%] bg-soil" />
      {locked ? null : (
        // The track spans the scene, so moving it by a percentage of its width moves the
        // character by the same share of the scene, with a transform rather than a layout change.
        <m.div
          animate={{ x: `${potCentres[target] ?? 50}%` }}
          className="absolute inset-x-0 bottom-[16%] z-10"
          initial={false}
          transition={reduced ? { duration: 0 } : { duration: WALK_MS / 1000, ease: 'easeInOut' }}
        >
          <div className="w-[46%] -translate-x-[62%]">
            <Sprite
              character={character}
              label={t('garden.caretaker', { character: characterNames[character] })}
              motion={walking ? 'walk' : 'water'}
            />
          </div>
        </m.div>
      )}
      <ol className="absolute inset-x-0 bottom-[8%] z-20 grid grid-cols-3">
        {chapter.plants.map((plant, position) => (
          <li className="flex justify-center" key={plant.id}>
            <Plant
              className={cn(
                'h-auto w-[80%]',
                !walking &&
                  position === target &&
                  plant.stage !== 'locked' &&
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
      {locked ? (
        <p className="absolute inset-x-0 top-1/3 z-30 text-center text-subhead font-extrabold text-label-2">
          {t('garden.lockedChapter')}
        </p>
      ) : null}
    </figure>
  )
}

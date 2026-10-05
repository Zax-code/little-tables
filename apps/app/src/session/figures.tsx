/** Fractions drawn in the garden: a flower bed in equal parts, a bed to plant, a round pot. */
import { cn } from '@little-tables/ui'
import { m, useReducedMotion } from 'motion/react'

import { useI18n } from '../i18n/i18n.js'
import { bedColumns } from './fraction-figures.js'

type FlowerTone = 'gold' | 'lavender' | 'pink'

const petalColour: Readonly<Record<FlowerTone, string>> = {
  gold: 'var(--garden-bloom-gold)',
  lavender: 'var(--garden-bloom-lavender)',
  pink: 'var(--garden-bloom-pink)',
}

/** A five-petal flower; parts are told apart by the flower, never by colour alone. */
function FlowerGlyph({ tone = 'pink' }: Readonly<{ tone?: FlowerTone }>) {
  return (
    <svg aria-hidden className="h-full max-h-12 w-auto" focusable="false" viewBox="0 0 40 48">
      <path
        d="M20 28 C20 36 19 41 20 47"
        fill="none"
        stroke="var(--garden-leaf-deep)"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path d="M20 40 C14 37 11 38 9 40 C13 43 17 43 20 41" fill="var(--garden-leaf-light)" />
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          cx="20"
          cy="10"
          fill={petalColour[tone]}
          key={angle}
          rx="7"
          ry="9"
          transform={`rotate(${angle} 20 19)`}
        />
      ))}
      <circle cx="20" cy="19" fill="var(--garden-center-yellow)" r="5.5" />
    </svg>
  )
}

const bedClass = 'grid w-full max-w-sm gap-1.5 rounded-[1.25rem] bg-soil p-2'
const partClass = 'flex aspect-[3/4] items-center justify-center rounded-xl p-1.5'

type GardenBedProps = Readonly<{
  className?: string
  /** One row, smaller: inside a hint or a story. */
  compact?: boolean
  denominator: number
  filled: ReadonlyArray<boolean>
  label: string
  tone?: FlowerTone
}>

export function GardenBed({
  className,
  compact = false,
  denominator,
  filled,
  label,
  tone,
}: GardenBedProps) {
  const reduced = useReducedMotion() === true
  return (
    <div
      aria-label={label}
      className={cn(bedClass, compact && 'max-w-60 gap-1 p-1.5', className)}
      role="img"
      style={{
        gridTemplateColumns: `repeat(${compact ? denominator : bedColumns(denominator)}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: denominator }, (_, index) => (
        <span
          className={cn(
            partClass,
            compact && 'rounded-lg p-1',
            filled[index] ? 'bg-tint-soft' : 'bg-surface-2',
          )}
          key={index}
        >
          {filled[index] ? (
            <m.span
              animate={{ scale: 1, y: 0 }}
              className="flex h-full items-center"
              initial={reduced ? false : { scale: 0.4, y: 6 }}
              transition={{ delay: reduced ? 0 : index * 0.03, stiffness: 320, type: 'spring' }}
            >
              <FlowerGlyph tone={tone ?? 'pink'} />
            </m.span>
          ) : null}
        </span>
      ))}
    </div>
  )
}

type PlantingBedProps = Readonly<{
  correct: boolean | null
  denominator: number
  onToggle: (index: number) => void
  planted: ReadonlyArray<number>
  settled: boolean
}>

/** The same bed, each part a toggle the child taps to plant a flower. */
export function PlantingBed({
  correct,
  denominator,
  onToggle,
  planted,
  settled,
}: PlantingBedProps) {
  const { t } = useI18n()
  const reduced = useReducedMotion() === true
  return (
    <div
      aria-label={t('figure.plantingBed', { parts: denominator })}
      className={cn(
        bedClass,
        settled && correct === true && 'ring-3 ring-leaf',
        settled && correct === false && 'ring-3 ring-sun',
      )}
      role="group"
      style={{ gridTemplateColumns: `repeat(${bedColumns(denominator)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: denominator }, (_, index) => {
        const on = planted.includes(index)
        return (
          <button
            aria-label={t('figure.part', { index: index + 1, parts: denominator })}
            aria-pressed={on}
            className={cn(
              partClass,
              'transition-colors active:scale-95',
              on ? 'bg-tint-soft' : 'bg-surface-2',
            )}
            disabled={settled}
            key={index}
            onClick={() => onToggle(index)}
            type="button"
          >
            {on ? (
              <m.span
                animate={{ scale: 1, y: 0 }}
                className="flex h-full items-center"
                initial={reduced ? false : { scale: 0.3, y: 10 }}
                transition={{ stiffness: 380, type: 'spring' }}
              >
                <FlowerGlyph />
              </m.span>
            ) : (
              <span aria-hidden className="text-title-2 text-label-3">
                ·
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** A round pot seen from above, cut into equal slices. */
export function GardenPot({
  denominator,
  filled,
  label,
}: Readonly<{ denominator: number; filled: ReadonlyArray<boolean>; label: string }>) {
  const radius = 46
  const slice = (index: number) => {
    const start = (index / denominator) * Math.PI * 2 - Math.PI / 2
    const end = ((index + 1) / denominator) * Math.PI * 2 - Math.PI / 2
    const large = end - start > Math.PI ? 1 : 0
    const [x1, y1] = [50 + radius * Math.cos(start), 50 + radius * Math.sin(start)]
    const [x2, y2] = [50 + radius * Math.cos(end), 50 + radius * Math.sin(end)]
    return denominator === 1
      ? 'M50 4 A46 46 0 1 1 49.99 4 Z'
      : `M50 50 L${x1} ${y1} A${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
  }
  return (
    <svg aria-label={label} className="size-56 max-w-full" role="img" viewBox="0 0 100 100">
      <circle cx="50" cy="50" fill="var(--garden-pot-pink)" r="49" />
      {Array.from({ length: denominator }, (_, index) => {
        const middle = ((index + 0.5) / denominator) * Math.PI * 2 - Math.PI / 2
        return (
          <g key={index}>
            <path
              d={slice(index)}
              fill={filled[index] ? 'var(--garden-leaf-soft)' : 'var(--garden-soil)'}
              stroke="var(--lt-surface)"
              strokeWidth="1.6"
            />
            {filled[index] ? (
              <g
                transform={`translate(${50 + 29 * Math.cos(middle) - 7} ${50 + 29 * Math.sin(middle) - 8}) scale(0.35)`}
              >
                {[0, 72, 144, 216, 288].map((angle) => (
                  <ellipse
                    cx="20"
                    cy="10"
                    fill="var(--garden-bloom-pink)"
                    key={angle}
                    rx="7"
                    ry="9"
                    transform={`rotate(${angle} 20 19)`}
                  />
                ))}
                <circle cx="20" cy="19" fill="var(--garden-center-yellow)" r="5.5" />
              </g>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

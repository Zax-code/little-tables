import { m, useReducedMotion } from 'motion/react'

import { bedColumns } from '../fraction-layout.js'
import { useI18n } from '../i18n.js'

/** A five-petal flower drawn in the garden palette; parts are never told apart by colour alone. */
function FlowerGlyph({ tone = 'pink' }: Readonly<{ tone?: 'gold' | 'lavender' | 'pink' }>) {
  const petal =
    tone === 'gold'
      ? 'var(--garden-bloom-gold)'
      : tone === 'lavender'
        ? 'var(--garden-bloom-lavender)'
        : 'var(--garden-bloom-pink)'
  return (
    <svg aria-hidden="true" className="flower-glyph" focusable="false" viewBox="0 0 40 48">
      <path
        d="M20 28 C20 36 19 41 20 47"
        stroke="var(--garden-leaf-deep)"
        strokeLinecap="round"
        strokeWidth="3"
        fill="none"
      />
      <path d="M20 40 C14 37 11 38 9 40 C13 43 17 43 20 41" fill="var(--garden-leaf-light)" />
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          cx="20"
          cy="10"
          fill={petal}
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

type GardenBedProps = Readonly<{
  className?: string
  compact?: boolean
  denominator: number
  filled: ReadonlyArray<boolean>
  label: string
  tone?: 'gold' | 'lavender' | 'pink'
}>

/** A raised flower bed split into equal parts; the planted parts show a flower. */
export function GardenBed({
  className = '',
  compact = false,
  denominator,
  filled,
  label,
  tone,
}: GardenBedProps) {
  const reduceMotion = useReducedMotion() === true
  const columns = compact ? denominator : bedColumns(denominator)
  return (
    <div
      aria-label={label}
      className={`garden-bed${compact ? ' garden-bed-compact' : ''} ${className}`}
      role="img"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: denominator }, (_, index) => (
        <span className={`bed-part${filled[index] ? ' is-planted' : ''}`} key={index}>
          {filled[index] ? (
            <m.span
              animate={{ scale: 1, y: 0 }}
              className="bed-flower"
              initial={reduceMotion ? false : { scale: 0.4, y: 6 }}
              transition={{
                delay: reduceMotion ? 0 : index * 0.03,
                stiffness: 320,
                type: 'spring',
              }}
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
  denominator: number
  onToggle: (index: number) => void
  planted: ReadonlyArray<number>
  settled: boolean
  correct: boolean | null
}>

/** The same bed, where each part is a toggle button the learner taps to plant a flower. */
export function PlantingBed({
  correct,
  denominator,
  onToggle,
  planted,
  settled,
}: PlantingBedProps) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion() === true
  return (
    <div
      aria-label={t('figure.plantingBed', { parts: denominator })}
      className={`garden-bed planting-bed${settled ? (correct ? ' is-correct' : ' is-try-again') : ''}`}
      role="group"
      style={{ gridTemplateColumns: `repeat(${bedColumns(denominator)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: denominator }, (_, index) => {
        const on = planted.includes(index)
        return (
          <button
            aria-label={t('figure.part', { index: index + 1, parts: denominator })}
            aria-pressed={on}
            className={`bed-part${on ? ' is-planted' : ''}`}
            disabled={settled}
            key={index}
            onClick={() => onToggle(index)}
            type="button"
          >
            {on ? (
              <m.span
                animate={{ scale: 1, y: 0 }}
                className="bed-flower"
                initial={reduceMotion ? false : { scale: 0.3, y: 10 }}
                transition={{ stiffness: 380, type: 'spring' }}
              >
                <FlowerGlyph />
              </m.span>
            ) : (
              <span aria-hidden="true" className="bed-seed">
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
  const slice = (index: number): string => {
    const start = (index / denominator) * Math.PI * 2 - Math.PI / 2
    const end = ((index + 1) / denominator) * Math.PI * 2 - Math.PI / 2
    const large = end - start > Math.PI ? 1 : 0
    const x1 = 50 + radius * Math.cos(start)
    const y1 = 50 + radius * Math.sin(start)
    const x2 = 50 + radius * Math.cos(end)
    const y2 = 50 + radius * Math.sin(end)
    return denominator === 1
      ? `M50 4 A46 46 0 1 1 49.99 4 Z`
      : `M50 50 L${x1} ${y1} A${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
  }
  return (
    <svg aria-label={label} className="garden-pot" role="img" viewBox="0 0 100 100">
      <circle cx="50" cy="50" fill="var(--garden-pot-pink)" r="49" />
      {Array.from({ length: denominator }, (_, index) => {
        const middle = ((index + 0.5) / denominator) * Math.PI * 2 - Math.PI / 2
        return (
          <g key={index}>
            <path
              d={slice(index)}
              fill={filled[index] ? 'var(--garden-leaf-soft)' : 'var(--garden-soil)'}
              stroke="var(--surface-card)"
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

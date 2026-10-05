import { m, useReducedMotion } from 'motion/react'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { fractionInWords } from '../exercise-format.js'
import { useI18n } from '../i18n.js'

const WIDTH = 340
const PAD = 26
const LINE_Y = 78

const xFor = (index: number, steps: number): number => PAD + (index / steps) * (WIDTH - PAD * 2)

function Ladybug({ ghost = false, x }: Readonly<{ ghost?: boolean; x: number }>) {
  const reduceMotion = useReducedMotion() === true
  return (
    <m.g
      animate={{ x }}
      className={ghost ? 'ruler-ladybug is-ghost' : 'ruler-ladybug'}
      initial={false}
      transition={reduceMotion ? { duration: 0 } : { damping: 22, stiffness: 340, type: 'spring' }}
    >
      <line stroke="var(--ink-primary)" strokeWidth="1.6" x1="0" x2="0" y1="46" y2={LINE_Y - 4} />
      <g transform="translate(0 -6) scale(1.4) translate(0 -8)">
        <ellipse cx="0" cy="31" fill="var(--accent-red)" rx="13" ry="11.5" />
        <path d="M-10 25 A11 9 0 0 1 10 25 Z" fill="var(--ink-primary)" />
        <line stroke="var(--ink-primary)" strokeWidth="1.2" x1="0" x2="0" y1="25" y2="42" />
        <circle cx="-6" cy="33" fill="var(--ink-primary)" r="2.4" />
        <circle cx="6" cy="33" fill="var(--ink-primary)" r="2.4" />
        <circle cx="-4" cy="39" fill="var(--ink-primary)" r="1.7" />
        <circle cx="4" cy="39" fill="var(--ink-primary)" r="1.7" />
        <circle cx="-3" cy="22" fill="var(--surface-card)" r="1.6" />
        <circle cx="3" cy="22" fill="var(--surface-card)" r="1.6" />
      </g>
    </m.g>
  )
}

type FractionRulerProps = Readonly<{
  /** Where the ladybug sits, counted in ticks. */
  ladybug: number | null
  /** After answering, the right graduation is marked and named. */
  reveal?: Readonly<{ index: number; label: string }> | null
  ticks: number
  units: 1 | 2
}>

function RulerDrawing({ ladybug, reveal = null, ticks, units }: FractionRulerProps) {
  const steps = ticks * units
  return (
    <svg
      aria-hidden="true"
      className="fraction-ruler-svg"
      focusable="false"
      viewBox={`0 0 ${WIDTH} 122`}
    >
      <rect
        fill="var(--garden-bloom-cream)"
        height="34"
        rx="10"
        stroke="var(--line-garden)"
        strokeWidth="1.5"
        width={WIDTH - 8}
        x="4"
        y={LINE_Y - 8}
      />
      <line
        stroke="var(--garden-soil)"
        strokeLinecap="round"
        strokeWidth="3"
        x1={PAD}
        x2={WIDTH - PAD}
        y1={LINE_Y}
        y2={LINE_Y}
      />
      {Array.from({ length: steps + 1 }, (_, index) => {
        const major = index % ticks === 0
        const x = xFor(index, steps)
        return (
          <g key={index}>
            <line
              stroke="var(--garden-soil)"
              strokeLinecap="round"
              strokeWidth={major ? 3.5 : 2.5}
              x1={x}
              x2={x}
              y1={LINE_Y}
              y2={LINE_Y + (major ? 20 : 12)}
            />
            {major ? (
              <text className="ruler-unit-label" textAnchor="middle" x={x} y={LINE_Y + 40}>
                {index / ticks}
              </text>
            ) : null}
          </g>
        )
      })}
      {reveal === null ? null : (
        <g>
          <circle cx={xFor(reveal.index, steps)} cy={LINE_Y} fill="var(--accent-green)" r="6" />
          <text
            className="ruler-reveal-label"
            textAnchor="middle"
            x={Math.min(WIDTH - 30, Math.max(30, xFor(reveal.index, steps)))}
            y={LINE_Y + 40}
          >
            {reveal.label}
          </text>
        </g>
      )}
      {ladybug === null ? null : <Ladybug x={xFor(ladybug, steps)} />}
    </svg>
  )
}

/** A ruler where a ladybug already sits on a graduation, for reading its position. */
export function FractionRuler(props: FractionRulerProps) {
  return (
    <div className="fraction-ruler">
      <RulerDrawing {...props} />
    </div>
  )
}

type PlacingRulerProps = Readonly<{
  onPlace: (index: number) => void
  reveal: Readonly<{ index: number; label: string }> | null
  settled: boolean
  ticks: number
  units: 1 | 2
}>

/**
 * The learner moves the ladybug along the ruler, by dragging, tapping, the big arrow buttons or
 * the keyboard (it is a slider), then confirms the position.
 */
export function PlacingRuler({ onPlace, reveal, settled, ticks, units }: PlacingRulerProps) {
  const { locale, t } = useI18n()
  const [position, setPosition] = useState(0)
  const dragging = useRef(false)
  const steps = ticks * units
  const clamp = (value: number) => Math.min(steps, Math.max(0, value))
  const positionWords =
    position === 0
      ? t('ruler.zero')
      : fractionInWords(
          {
            denominator: ticks,
            numerator: position % ticks,
            whole: Math.floor(position / ticks),
          },
          locale,
        )

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    const local = ratio * WIDTH
    setPosition(clamp(Math.round(((local - PAD) / (WIDTH - PAD * 2)) * steps)))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (settled) return
    const moves: Readonly<Record<string, number>> = {
      ArrowDown: -1,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: 1,
    }
    if (event.key in moves) {
      event.preventDefault()
      setPosition((current) => clamp(current + (moves[event.key] ?? 0)))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setPosition(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setPosition(steps)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      onPlace(position)
    }
  }

  return (
    <div className="placing-ruler">
      <div
        aria-disabled={settled}
        aria-label={t('ruler.sliderLabel')}
        aria-valuemax={steps}
        aria-valuemin={0}
        aria-valuenow={position}
        aria-valuetext={positionWords}
        className="fraction-ruler is-interactive"
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (settled) return
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          moveTo(event)
        }}
        onPointerMove={(event) => {
          if (dragging.current && !settled) moveTo(event)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        role="slider"
        tabIndex={0}
      >
        <RulerDrawing ladybug={position} reveal={reveal} ticks={ticks} units={units} />
      </div>
      <div className="ruler-controls">
        <button
          aria-label={t('ruler.left')}
          className="ruler-step"
          disabled={settled || position === 0}
          onClick={() => setPosition((current) => clamp(current - 1))}
          type="button"
        >
          ◀
        </button>
        <button
          className="primary-button ruler-confirm"
          disabled={settled || position === 0}
          onClick={() => onPlace(position)}
          type="button"
        >
          {t('ruler.confirm')}
        </button>
        <button
          aria-label={t('ruler.right')}
          className="ruler-step"
          disabled={settled || position === steps}
          onClick={() => setPosition((current) => clamp(current + 1))}
          type="button"
        >
          ▶
        </button>
      </div>
      <span className="recall-note">{t('ruler.help')}</span>
    </div>
  )
}

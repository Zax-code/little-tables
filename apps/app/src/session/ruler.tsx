/** The fraction ruler and its ladybug (mockup C8), for reading or placing a fraction. */
import { Button } from '@little-tables/ui'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { m, useReducedMotion } from 'motion/react'
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

import { useI18n } from '../i18n/i18n.js'
import { fractionInWords } from './format.js'

const WIDTH = 340
const PAD = 26
const LINE_Y = 78

const xFor = (index: number, steps: number) => PAD + (index / steps) * (WIDTH - PAD * 2)

function Ladybug({ x }: Readonly<{ x: number }>) {
  const reduced = useReducedMotion() === true
  return (
    <m.g
      animate={{ x }}
      initial={false}
      transition={reduced ? { duration: 0 } : { damping: 22, stiffness: 340, type: 'spring' }}
    >
      <line stroke="var(--ink-primary)" strokeWidth="1.6" x1="0" x2="0" y1="46" y2={LINE_Y - 4} />
      <g transform="translate(0 -6) scale(1.4) translate(0 -8)">
        <ellipse cx="0" cy="31" fill="var(--lt-danger)" rx="13" ry="11.5" />
        <path d="M-10 25 A11 9 0 0 1 10 25 Z" fill="var(--ink-primary)" />
        <line stroke="var(--ink-primary)" strokeWidth="1.2" x1="0" x2="0" y1="25" y2="42" />
        <circle cx="-6" cy="33" fill="var(--ink-primary)" r="2.4" />
        <circle cx="6" cy="33" fill="var(--ink-primary)" r="2.4" />
        <circle cx="-4" cy="39" fill="var(--ink-primary)" r="1.7" />
        <circle cx="4" cy="39" fill="var(--ink-primary)" r="1.7" />
        <circle cx="-3" cy="22" fill="#fff" r="1.6" />
        <circle cx="3" cy="22" fill="#fff" r="1.6" />
      </g>
    </m.g>
  )
}

export type RulerReveal = Readonly<{ index: number; label: string }>

type RulerDrawingProps = Readonly<{
  /** Where the ladybug sits, counted in ticks; none when hidden. */
  ladybug: number | null
  reveal?: RulerReveal | null
  ticks: number
  units: number
}>

export function RulerDrawing({ ladybug, reveal = null, ticks, units }: RulerDrawingProps) {
  const steps = ticks * units
  return (
    <svg aria-hidden className="w-full max-w-sm" focusable="false" viewBox={`0 0 ${WIDTH} 122`}>
      <line
        stroke="var(--lt-label)"
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
              stroke="var(--lt-label)"
              strokeLinecap="round"
              strokeWidth={major ? 3.5 : 2.5}
              x1={x}
              x2={x}
              y1={LINE_Y - (major ? 12 : 8)}
              y2={LINE_Y + (major ? 12 : 8)}
            />
            {major ? (
              <text
                className="fill-label text-[1.1rem] font-extrabold"
                textAnchor="middle"
                x={x}
                y={LINE_Y + 36}
              >
                {index / ticks}
              </text>
            ) : null}
          </g>
        )
      })}
      {reveal === null ? null : (
        <g>
          <circle cx={xFor(reveal.index, steps)} cy={LINE_Y} fill="var(--lt-leaf)" r="6" />
          <text
            className="fill-leaf text-[1rem] font-extrabold"
            textAnchor="middle"
            x={Math.min(WIDTH - 30, Math.max(30, xFor(reveal.index, steps)))}
            y={LINE_Y + 36}
          >
            {reveal.label}
          </text>
        </g>
      )}
      {ladybug === null ? null : <Ladybug x={xFor(ladybug, steps)} />}
    </svg>
  )
}

type RulerSliderProps = Readonly<{
  onConfirm: () => void
  onMove: (position: number) => void
  position: number
  reveal: RulerReveal | null
  settled: boolean
  ticks: number
  units: number
}>

/** The ruler as a slider: drag or tap the ladybug, or use the arrow keys and Enter. */
export function RulerSlider({
  onConfirm,
  onMove,
  position,
  reveal,
  settled,
  ticks,
  units,
}: RulerSliderProps) {
  const translator = useI18n()
  const { t } = translator
  const dragging = useRef(false)
  const steps = ticks * units
  const clamp = (value: number) => Math.min(steps, Math.max(0, value))
  const words =
    position === 0
      ? t('ruler.zero')
      : fractionInWords(
          { denominator: ticks, numerator: position % ticks, whole: Math.floor(position / ticks) },
          translator.language,
        )

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const local = ((event.clientX - box.left) / box.width) * WIDTH
    onMove(clamp(Math.round(((local - PAD) / (WIDTH - PAD * 2)) * steps)))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (settled) return
    const moves: Readonly<Record<string, number>> = {
      ArrowDown: -1,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: 1,
    }
    const move = moves[event.key]
    if (move !== undefined) {
      event.preventDefault()
      onMove(clamp(position + move))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      onMove(event.key === 'Home' ? 0 : steps)
    } else if (event.key === 'Enter' && position > 0) {
      event.preventDefault()
      onConfirm()
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div
        aria-disabled={settled}
        aria-label={t('ruler.sliderLabel')}
        aria-valuemax={steps}
        aria-valuemin={0}
        aria-valuenow={position}
        aria-valuetext={words}
        className="w-full max-w-sm touch-none rounded-control outline-none focus-visible:ring-3 focus-visible:ring-tint"
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
        onLostPointerCapture={() => {
          // Pointer up, a cancelled touch (scroll, app switch, rotation): the drag ends either way.
          dragging.current = false
        }}
        role="slider"
        tabIndex={0}
      >
        <RulerDrawing ladybug={position} reveal={reveal} ticks={ticks} units={units} />
      </div>
      <p className="text-footnote font-semibold text-label-2">{t('ruler.help')}</p>
    </div>
  )
}

type RulerControlsProps = Readonly<{
  onConfirm: () => void
  onMove: (position: number) => void
  position: number
  settled: boolean
  steps: number
}>

/** The arrows and the confirmation, in the answer panel. */
export function RulerControls({ onConfirm, onMove, position, settled, steps }: RulerControlsProps) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          aria-label={t('ruler.left')}
          disabled={settled || position === 0}
          onClick={() => onMove(Math.max(0, position - 1))}
          variant="gray"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </Button>
        <Button
          aria-label={t('ruler.right')}
          disabled={settled || position === steps}
          onClick={() => onMove(Math.min(steps, position + 1))}
          variant="gray"
        >
          <ChevronRight aria-hidden className="size-6" />
        </Button>
      </div>
      <Button
        disabled={settled || position === 0}
        icon={<MapPin aria-hidden className="size-5" />}
        onClick={onConfirm}
        size="lg"
        width="full"
      >
        {t('ruler.confirm')}
      </Button>
    </div>
  )
}

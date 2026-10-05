import { Delete } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import { cn } from './cn.js'

/* ------------------------------------------------------------------------------------------ */
/* Keypads                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'erase' | 'submit'

const rows: ReadonlyArray<ReadonlyArray<PadKey>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['erase', '0', 'submit'],
]

export type NumberPadProps = Readonly<{
  className?: string
  eraseLabel?: string
  /** Names the keypad for assistive technologies. */
  label: string
  onKey: (key: PadKey) => void
  submitDisabled?: boolean
  submitLabel?: string
}>

/** The single keypad used by every exercise, at thumb height. */
export function NumberPad({
  className,
  eraseLabel = 'Effacer',
  label,
  onKey,
  submitDisabled = false,
  submitLabel = 'Valider',
}: NumberPadProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)} role="group" aria-label={label}>
      {rows.flat().map((key) => (
        <button
          aria-label={key === 'erase' ? eraseLabel : key === 'submit' ? submitLabel : undefined}
          className={cn(
            'flex h-14 items-center justify-center rounded-[1.125rem] text-[1.75rem] font-extrabold tabular transition-transform active:scale-95',
            'shadow-[0_2px_0_var(--lt-separator)]',
            key === 'submit'
              ? 'bg-tint text-on-tint disabled:opacity-45'
              : key === 'erase'
                ? 'bg-surface-2 text-label'
                : 'bg-surface text-label',
          )}
          disabled={key === 'submit' && submitDisabled}
          key={key}
          onClick={() => onKey(key)}
          type="button"
        >
          {key === 'erase' ? (
            <Delete aria-hidden className="size-6" />
          ) : key === 'submit' ? (
            '✓'
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  )
}

export type PinPadProps = Readonly<{
  className?: string
  eraseLabel: string
  length?: number
  onKey: (key: Exclude<PadKey, 'submit'>) => void
  /** Spoken progress, e.g. "2 digits of 4". */
  progressLabel: string
  value: string
}>

/** Four dots and round keys, for the parent code. */
export function PinPad({
  className,
  eraseLabel,
  length = 4,
  onKey,
  progressLabel,
  value,
}: PinPadProps) {
  const keys: ReadonlyArray<Exclude<PadKey, 'submit'> | null> = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    null,
    '0',
    'erase',
  ]
  return (
    <div className={cn('flex flex-col items-center gap-8', className)}>
      <div aria-label={progressLabel} className="flex gap-5" role="status">
        {Array.from({ length }, (_, index) => (
          <span
            className={cn(
              'size-4.5 rounded-full border-2 border-tint',
              index < value.length && 'bg-tint',
            )}
            key={index}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {keys.map((key, index) =>
          key === null ? (
            <span key={index} />
          ) : (
            <button
              aria-label={key === 'erase' ? eraseLabel : key}
              className={cn(
                'flex size-19.5 items-center justify-center rounded-full text-[1.875rem] font-bold transition-transform active:scale-95',
                key === 'erase' ? 'text-label-2' : 'bg-surface text-label',
              )}
              key={key}
              onClick={() => onKey(key)}
              type="button"
            >
              {key === 'erase' ? <Delete aria-hidden className="size-7" /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Answers                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export type TileState = 'correct' | 'dimmed' | 'idle' | 'wrong'

export type AnswerTilesProps<Value> = Readonly<{
  className?: string
  disabled?: boolean
  label: string
  onPick: (value: Value, index: number) => void
  render: (value: Value) => ReactNode
  /** Accessible name of each value; defaults to its text. */
  speak?: (value: Value) => string
  stateOf?: (value: Value, index: number) => TileState
  values: ReadonlyArray<Value>
}>

/** Two columns of large answer tiles. */
export function AnswerTiles<Value>({
  className,
  disabled = false,
  label,
  onPick,
  render,
  speak,
  stateOf,
  values,
}: AnswerTilesProps<Value>) {
  return (
    <div aria-label={label} className={cn('grid grid-cols-2 gap-2.5', className)} role="group">
      {values.map((value, index) => {
        const state = stateOf?.(value, index) ?? 'idle'
        return (
          <button
            aria-label={speak?.(value)}
            aria-pressed={state === 'correct' || state === 'wrong'}
            className={cn(
              'flex min-h-24 items-center justify-center rounded-[1.5rem] border-2 text-[2.5rem] font-black tabular transition-[transform,opacity] active:scale-[0.97]',
              'shadow-[0_3px_0_var(--lt-separator)]',
              state === 'correct' && 'border-leaf bg-leaf-soft text-leaf',
              state === 'wrong' && 'border-sun bg-sun-soft text-sun',
              state === 'dimmed' && 'border-separator bg-surface opacity-45',
              state === 'idle' && 'border-separator bg-surface text-label',
            )}
            disabled={disabled}
            key={index}
            onClick={() => onPick(value, index)}
            type="button"
          >
            {render(value)}
          </button>
        )
      })}
    </div>
  )
}

export type FractionTextProps = Readonly<{
  className?: string
  /** A number, or any content such as a blank to fill in. */
  denominator: ReactNode
  /** Spoken form in the reader's language, e.g. "three quarters". */
  label?: string
  numerator: ReactNode
  /** Whole units written before the fraction, as in 1 ½. */
  whole?: number
}>

/** A fraction written as at school: numerator over a bar over the denominator. */
export function FractionText({
  className,
  denominator,
  label,
  numerator,
  whole = 0,
}: FractionTextProps) {
  const plain = (part: ReactNode) =>
    typeof part === 'number' || typeof part === 'string' ? String(part) : '?'
  const spoken = label ?? `${whole > 0 ? `${whole} ` : ''}${plain(numerator)}/${plain(denominator)}`
  return (
    <span
      aria-label={spoken}
      className={cn('inline-flex items-center gap-[0.15em] font-black tabular', className)}
      role="img"
    >
      {whole > 0 ? <span aria-hidden>{whole}</span> : null}
      <span aria-hidden className="inline-flex flex-col items-center leading-none">
        <span>{numerator}</span>
        <span className="my-[0.08em] h-[0.09em] min-h-0.5 w-[1.1em] rounded-full bg-current" />
        <span>{denominator}</span>
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* Character dock                                                                             */
/* ------------------------------------------------------------------------------------------ */

export type SpeechBubbleProps = Readonly<{
  children: ReactNode
  className?: string
  tone?: 'leaf' | 'neutral' | 'sun'
}>

export function SpeechBubble({ children, className, tone = 'neutral' }: SpeechBubbleProps) {
  return (
    <div
      className={cn(
        'rounded-[1.25rem] rounded-br-md border border-separator bg-surface px-4 py-2.5 shadow-sm',
        tone === 'leaf' && '[&_strong]:text-leaf',
        tone === 'sun' && '[&_strong]:text-sun',
        className,
      )}
      role="status"
    >
      {children}
    </div>
  )
}

export type CharacterPose = 'correct' | 'encourage' | 'idle'

export type CharacterDockProps = Readonly<{
  /** Text of the speech bubble; none while idle. */
  bubble?: ReactNode
  className?: string
  pose: CharacterPose
  /** Image of each pose. Every image ends on the panel's edge. */
  poses: Readonly<Record<CharacterPose, string>>
  /** A short description for assistive technologies. */
  label: string
}>

const poseSize: Record<CharacterPose, Readonly<{ height: number; width: number }>> = {
  correct: { height: 138, width: 104 },
  encourage: { height: 140, width: 118 },
  idle: { height: 90, width: 78 },
}

/**
 * The character leaning on the top edge of the answer panel. While idle only the head and paws
 * show and it breathes; a right answer lifts it with a spring and raises its arms; a wrong one
 * brings the head out calmly, hand on chin. With reduced motion the poses simply fade.
 */
export function CharacterDock({ bubble, className, label, pose, poses }: CharacterDockProps) {
  const reduced = useReducedMotion() ?? false
  const size = poseSize[pose]
  const transition = reduced
    ? { duration: 0.15 }
    : pose === 'correct'
      ? { bounce: 0.45, duration: 0.5, type: 'spring' as const }
      : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }
  return (
    <div
      className={cn('pointer-events-none flex items-center justify-end gap-2.5 px-5', className)}
      style={{ minHeight: size.height }}
    >
      {bubble === undefined || bubble === null ? null : (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          key={`bubble-${pose}`}
          style={{ originX: 1, originY: 1 }}
          transition={transition}
        >
          <SpeechBubble
            tone={pose === 'correct' ? 'leaf' : pose === 'encourage' ? 'sun' : 'neutral'}
          >
            {bubble}
          </SpeechBubble>
        </motion.div>
      )}
      <motion.img
        alt={label}
        animate={
          reduced
            ? { opacity: 1 }
            : pose === 'idle'
              ? { opacity: 1, y: [0, -2, 0] }
              : { opacity: 1, y: 0 }
        }
        className="-mb-1.5 block self-end object-contain object-bottom"
        height={size.height}
        initial={reduced ? { opacity: 0 } : { opacity: 1, y: size.height * 0.45 }}
        key={pose}
        src={poses[pose]}
        transition={
          pose === 'idle' && !reduced
            ? { duration: 3, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
            : transition
        }
        width={size.width}
      />
    </div>
  )
}

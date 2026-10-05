import type { ReactNode } from 'react'

import { cn } from './cn.js'

type Tone = 'leaf' | 'sky' | 'sun' | 'tint'

const toneFill: Record<Tone, string> = {
  leaf: 'bg-leaf',
  sky: 'bg-sky',
  sun: 'bg-sun',
  tint: 'bg-tint',
}

export type ProgressBarProps = Readonly<{
  className?: string
  label: string
  /** Number of equal segments, as in "1 watering of 3". Continuous when omitted. */
  segments?: number
  tone?: Tone
  /** Between 0 and 1, or the number of filled segments. */
  value: number
}>

export function ProgressBar({
  className,
  label,
  segments,
  tone = 'leaf',
  value,
}: ProgressBarProps) {
  if (segments !== undefined) {
    return (
      <div
        aria-label={label}
        aria-valuemax={segments}
        aria-valuemin={0}
        aria-valuenow={value}
        className={cn('flex w-full gap-1', className)}
        role="progressbar"
      >
        {Array.from({ length: segments }, (_, index) => (
          <span
            className={cn(
              'h-2 flex-1 rounded-full',
              index < value ? toneFill[tone] : 'bg-surface-2',
            )}
            key={index}
          />
        ))}
      </div>
    )
  }
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="progressbar"
    >
      <span
        className={cn('block h-full rounded-full', toneFill[tone])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}

export type ProgressRingProps = Readonly<{
  children?: ReactNode
  className?: string
  label: string
  size?: number
  value: number
}>

/** A ring that fills clockwise from the top. */
export function ProgressRing({ children, className, label, size = 72, value }: ProgressRingProps) {
  const stroke = size * 0.11
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('relative inline-flex items-center justify-center', className)}
      role="progressbar"
      style={{ height: size, width: size }}
    >
      <svg aria-hidden className="-rotate-90" height={size} width={size}>
        <circle
          className="stroke-surface-2"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="stroke-tint transition-[stroke-dashoffset] duration-500"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <span className="absolute text-title-3 font-black tabular">{children}</span>
    </div>
  )
}

export type AvatarProps = Readonly<{
  alt: string
  className?: string
  selected?: boolean
  size?: number
  src: string
}>

export function Avatar({ alt, className, selected = false, size = 40, src }: AvatarProps) {
  return (
    <img
      alt={alt}
      className={cn(
        'shrink-0 rounded-full bg-surface-2 object-cover',
        selected && 'ring-3 ring-tint',
        className,
      )}
      height={size}
      src={src}
      width={size}
    />
  )
}

export type BadgeProps = Readonly<{ children: ReactNode; className?: string; tone?: Tone }>

const toneSoft: Record<Tone, string> = {
  leaf: 'bg-leaf-soft text-leaf',
  sky: 'bg-sky-soft text-sky',
  sun: 'bg-sun-soft text-sun',
  tint: 'bg-tint-soft text-tint',
}

export function Badge({ children, className, tone = 'tint' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-footnote font-black',
        toneSoft[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export type EmptyStateProps = Readonly<{
  action?: ReactNode
  art?: ReactNode
  className?: string
  description: ReactNode
  title: ReactNode
}>

/** A centred illustration, title, text and action, for empty, offline and error screens. */
export function EmptyState({ action, art, className, description, title }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center',
        className,
      )}
    >
      {art}
      <h1 className="text-title-1 font-extrabold text-balance">{title}</h1>
      <p className="max-w-xs text-body font-semibold text-label-2 text-balance">{description}</p>
      {action}
    </div>
  )
}

export type WeekStripProps = Readonly<{
  className?: string
  days: ReadonlyArray<Readonly<{ label: string; practiced: boolean; today: boolean }>>
  status: ReactNode
  title: ReactNode
}>

/** The week in bloom: seven days, a flower on each practised one, today outlined. */
export function WeekStrip({ className, days, status, title }: WeekStripProps) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-card bg-surface p-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-body font-extrabold">{title}</h2>
        <span className="text-subhead font-bold text-label-2">{status}</span>
      </div>
      <ol className="flex justify-between">
        {days.map((day, index) => (
          <li className="flex flex-col items-center gap-1.5" key={index}>
            <span
              aria-label={`${day.label}${day.practiced ? ', arrosé' : ''}${day.today ? ", aujourd'hui" : ''}`}
              className={cn(
                'flex size-9.5 items-center justify-center rounded-full',
                day.practiced ? 'bg-leaf-soft text-leaf' : 'bg-surface-2',
                day.today && 'ring-2 ring-tint',
              )}
              role="img"
            >
              {day.practiced ? <FlowerGlyph /> : null}
            </span>
            <span
              aria-hidden
              className={cn('text-footnote font-bold', day.today ? 'text-tint' : 'text-label-2')}
            >
              {day.label}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function FlowerGlyph() {
  return (
    <svg aria-hidden className="size-5" fill="currentColor" viewBox="0 0 24 24">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          cx="12"
          cy="6.5"
          key={angle}
          rx="3.4"
          ry="4.6"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" fill="var(--lt-surface)" r="2.6" />
    </svg>
  )
}

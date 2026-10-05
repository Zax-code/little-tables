import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { ComponentPropsWithRef, ReactNode } from 'react'

import { cn } from './cn.js'

export type SwitchProps = ComponentPropsWithRef<typeof SwitchPrimitive.Root>

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-8 w-13 shrink-0 items-center rounded-full p-0.75 transition-colors',
        'bg-separator data-[state=checked]:bg-leaf',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-6.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  )
}

export type SegmentedControlProps<Value extends string> = Readonly<{
  className?: string
  label: string
  onChange: (value: Value) => void
  options: ReadonlyArray<Readonly<{ label: ReactNode; value: Value }>>
  value: Value
}>

export function SegmentedControl<Value extends string>({
  className,
  label,
  onChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  return (
    <ToggleGroup.Root
      aria-label={label}
      className={cn('flex h-9 w-full gap-0.75 rounded-[0.6875rem] bg-separator p-0.75', className)}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next)
        if (option !== undefined) onChange(option.value)
      }}
      type="single"
      value={value}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          className={cn(
            'flex-1 rounded-lg text-subhead font-bold text-label-2 transition-colors',
            'data-[state=on]:bg-surface data-[state=on]:font-extrabold data-[state=on]:text-label data-[state=on]:shadow-sm',
          )}
          key={option.value}
          value={option.value}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

export type ChipProps = ComponentPropsWithRef<'button'> &
  Readonly<{ icon?: ReactNode; selected?: boolean }>

/** A large tappable choice, such as a table to practise. */
export function Chip({
  children,
  className,
  disabled,
  icon,
  selected = false,
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-13 flex-1 items-center justify-center gap-1.5 rounded-control border px-3 text-title-3 font-extrabold transition-transform active:scale-[0.97]',
        selected ? 'border-tint bg-tint-soft text-tint' : 'border-separator bg-surface text-label',
        disabled === true && 'border-transparent bg-surface-2 text-label-3',
        className,
      )}
      disabled={disabled}
      type={type}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export type TextFieldProps = ComponentPropsWithRef<'input'> &
  Readonly<{ counter?: string; label: string }>

export function TextField({ className, counter, label, id, ...props }: TextFieldProps) {
  const inputId = id ?? `field-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <label className={cn('flex flex-col gap-1.5', className)} htmlFor={inputId}>
      <span className="sr-only">{label}</span>
      <span className="flex min-h-14 items-center gap-2 rounded-control border-2 border-transparent bg-surface px-4 focus-within:border-tint">
        <input
          className="min-w-0 flex-1 bg-transparent text-title-3 font-extrabold text-label outline-none placeholder:font-semibold placeholder:text-label-3"
          id={inputId}
          {...props}
        />
        {counter === undefined ? null : (
          // The limit is already known from `maxLength`; the name stays the label alone.
          <span aria-hidden className="text-footnote font-bold text-label-3">
            {counter}
          </span>
        )}
      </span>
    </label>
  )
}

export type TimePickerProps = Readonly<{
  className?: string
  /** How an hour reads in the user's language, e.g. `18 h` or `6 PM`. */
  formatHour: (hour: number) => string
  hourLabel: string
  /** Earliest and latest times, and the step, in minutes after midnight. */
  max: number
  min: number
  minuteLabel: string
  onChange: (minutes: number) => void
  step: number
  value: number
}>

const selectClass =
  'min-h-14 flex-1 appearance-none rounded-control border-2 border-transparent bg-surface px-4 text-center text-title-3 font-extrabold text-label outline-none focus-visible:border-tint'

/**
 * A time of day as an hour and minutes. Native selects open the system wheel on phones; the
 * minutes follow the step and stay within the range.
 */
export function TimePicker({
  className,
  formatHour,
  hourLabel,
  max,
  min,
  minuteLabel,
  onChange,
  step,
  value,
}: TimePickerProps) {
  const hour = Math.floor(value / 60)
  const hours = Array.from(
    { length: Math.floor(max / 60) - Math.floor(min / 60) + 1 },
    (_, index) => Math.floor(min / 60) + index,
  )
  const minutesOf = (candidate: number) =>
    Array.from({ length: 60 / step }, (_, index) => index * step).filter((minute) => {
      const total = candidate * 60 + minute
      return total >= min && total <= max
    })
  const clamp = (total: number) => Math.min(max, Math.max(min, total))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <select
        aria-label={hourLabel}
        className={selectClass}
        onChange={(event) => {
          const next = Number(event.target.value)
          const minutes = minutesOf(next)
          const kept = minutes.includes(value % 60) ? value % 60 : (minutes[0] ?? 0)
          onChange(clamp(next * 60 + kept))
        }}
        value={hour}
      >
        {hours.map((candidate) => (
          <option key={candidate} value={candidate}>
            {formatHour(candidate)}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-title-3 font-extrabold text-label-3">
        :
      </span>
      <select
        aria-label={minuteLabel}
        className={selectClass}
        onChange={(event) => onChange(clamp(hour * 60 + Number(event.target.value)))}
        value={value % 60}
      >
        {minutesOf(hour).map((minute) => (
          <option key={minute} value={minute}>
            {String(minute).padStart(2, '0')}
          </option>
        ))}
      </select>
    </div>
  )
}

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

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithRef, ReactNode } from 'react'

import { cn } from './cn.js'

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full font-extrabold',
    'transition-[transform,background-color,opacity] duration-150 ease-out-soft',
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
  ],
  {
    // Filled buttons show keyboard focus as a thin white ring inside rather than the pink outline.
    defaultVariants: { size: 'md', variant: 'primary' },
    variants: {
      size: {
        lg: 'min-h-15 px-6 text-title-3',
        md: 'min-h-13 px-5 text-body',
        sm: 'min-h-11 px-4 text-subhead',
      },
      variant: {
        destructive:
          'bg-danger text-on-tint focus-visible:outline-2 focus-visible:-outline-offset-[5px] focus-visible:outline-white/80',
        gray: 'bg-surface-2 text-label',
        plain: 'bg-transparent text-tint',
        primary:
          'bg-tint text-on-tint shadow-[0_6px_16px_color-mix(in_srgb,var(--lt-tint)_25%,transparent)]' +
          ' focus-visible:outline-2 focus-visible:-outline-offset-[5px] focus-visible:outline-white/80',
        success:
          'bg-leaf text-on-tint focus-visible:outline-2 focus-visible:-outline-offset-[5px] focus-visible:outline-white/80',
        tinted: 'bg-tint-soft text-tint',
      },
      width: { auto: '', full: 'w-full' },
    },
  },
)

export type ButtonProps = ComponentPropsWithRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the child element (a link, typically) with the button's look. */
    asChild?: boolean
    icon?: ReactNode
  }

export function Button({
  asChild = false,
  children,
  className,
  icon,
  size,
  type = 'button',
  variant,
  width,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ size, variant, width }), className)
  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button className={classes} type={type} {...props}>
      {icon}
      {children}
    </button>
  )
}

export type IconButtonProps = ComponentPropsWithRef<'button'> & {
  /** Read by assistive technologies: the button shows only an icon. */
  label: string
  tone?: 'glass' | 'surface' | 'tint'
}

/** A round 44 pt button holding a single icon. */
export function IconButton({
  children,
  className,
  label,
  tone = 'surface',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95',
        tone === 'surface' && 'border border-separator bg-surface text-label-2',
        tone === 'glass' && 'bg-glass text-label backdrop-blur-xl',
        tone === 'tint' && 'bg-tint text-on-tint',
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}

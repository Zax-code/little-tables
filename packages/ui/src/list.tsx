import { Check, ChevronRight } from 'lucide-react'
import { Children, type ComponentPropsWithRef, type ReactNode } from 'react'

import { cn } from './cn.js'

export type ListGroupProps = Readonly<{
  children: ReactNode
  className?: string
  footer?: ReactNode
  title?: ReactNode
}>

/** An inset grouped list, as in iOS Settings. */
export function ListGroup({ children, className, footer, title }: ListGroupProps) {
  const rows = Children.toArray(children)
  return (
    <section className={cn('flex flex-col gap-1.5', className)}>
      {title === undefined ? null : (
        <h2 className="px-4 text-footnote font-extrabold uppercase tracking-wide text-label-2">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-control bg-surface">
        {rows.map((row, index) => (
          <div className={cn(index > 0 && 'border-t border-separator')} key={index}>
            {row}
          </div>
        ))}
      </div>
      {footer === undefined ? null : (
        <p className="px-4 text-footnote font-semibold text-label-2">{footer}</p>
      )}
    </section>
  )
}

export type IconTileProps = Readonly<{ children: ReactNode; className?: string }>

/** The rounded colour tile in front of a settings row. */
export function IconTile({ children, className }: IconTileProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-[0.5625rem] bg-tint text-on-tint [&_svg]:size-4.5',
        className,
      )}
    >
      {children}
    </span>
  )
}

export type ListRowProps = Omit<ComponentPropsWithRef<'button'>, 'title'> &
  Readonly<{
    /** Any trailing control, such as a switch. */
    accessory?: ReactNode
    destructive?: boolean
    detail?: ReactNode
    leading?: ReactNode
    subtitle?: ReactNode
    title: ReactNode
    /** The standard trailing mark: a chevron for navigation, a check for the current choice. */
    trailing?: 'check' | 'chevron'
  }>

/** One row of a grouped list. It is a button when it has an `onClick`, plain content otherwise. */
export function ListRow({
  accessory,
  className,
  destructive = false,
  detail,
  leading,
  onClick,
  subtitle,
  title,
  trailing,
  type = 'button',
  ...props
}: ListRowProps) {
  const accessoryNode =
    trailing === 'chevron' ? (
      <ChevronRight aria-hidden className="size-5 text-label-3" />
    ) : trailing === 'check' ? (
      <Check aria-label="sélectionné" className="size-5 text-tint" />
    ) : (
      accessory
    )
  const content = (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className={cn('text-body font-semibold', destructive ? 'text-danger' : 'text-label')}>
          {title}
        </span>
        {subtitle === undefined ? null : (
          <span className="text-footnote font-semibold text-label-2">{subtitle}</span>
        )}
      </span>
      {detail === undefined ? null : (
        <span className="text-body font-semibold text-label-2">{detail}</span>
      )}
      {accessoryNode}
    </>
  )
  const classes = cn('flex min-h-14 w-full items-center gap-3.5 px-4 py-2', className)
  if (onClick === undefined) return <div className={classes}>{content}</div>
  return (
    <button className={cn(classes, 'active:bg-surface-2')} onClick={onClick} type={type} {...props}>
      {content}
    </button>
  )
}

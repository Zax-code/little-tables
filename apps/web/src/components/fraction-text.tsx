import type { ReactNode } from 'react'

type FractionTextProps = Readonly<{
  className?: string
  denominator: ReactNode
  /** Spoken name; without one, the fraction is decorative and hidden from screen readers. */
  label?: string
  numerator: ReactNode
  whole?: ReactNode
}>

/** A fraction written the school way: numerator above the bar, denominator below. */
export function FractionText({
  className = '',
  denominator,
  label,
  numerator,
  whole,
}: FractionTextProps) {
  return (
    <span
      className={`fraction-text ${className}`}
      {...(label === undefined ? { 'aria-hidden': true } : { 'aria-label': label, role: 'img' })}
    >
      {whole === undefined || whole === null || whole === 0 ? null : (
        <span className="fraction-whole">
          {whole}
          <span className="fraction-plus">+</span>
        </span>
      )}
      <span className="fraction-stack">
        <span className="fraction-numerator">{numerator}</span>
        <span className="fraction-bar" />
        <span className="fraction-denominator">{denominator}</span>
      </span>
    </span>
  )
}

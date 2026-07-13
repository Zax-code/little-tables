type ProgressDotsProps = Readonly<{ current: number; total: number }>

export function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <div
      aria-label={`${current} of ${total} questions complete`}
      className="progress-dots"
      role="progressbar"
      aria-valuemax={total}
      aria-valuemin={0}
      aria-valuenow={current}
    >
      {Array.from({ length: total }, (_, index) => (
        <span className={index < current ? 'dot dot-filled' : 'dot'} key={index} />
      ))}
    </div>
  )
}

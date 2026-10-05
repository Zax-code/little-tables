/** The bars that show how rooted a group of facts is. */
import type { LearningProgress } from '@little-tables/engine/schema'

type Counts = LearningProgress['facts']

/** A bar split into rooted, on their way and still to discover. */
export function StackedBar({ counts }: Readonly<{ counts: Counts }>) {
  const share = (value: number) => `${(value / Math.max(1, counts.total)) * 100}%`
  return (
    <span aria-hidden className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span className="bg-leaf" style={{ width: share(counts.fluent) }} />
      <span className="bg-sky" style={{ width: share(counts.familiar) }} />
      <span className="bg-sun" style={{ width: share(counts.growing) }} />
    </span>
  )
}

/** The same bar, sized for a list row. */
export function CountsBar({ counts }: Readonly<{ counts: Counts }>) {
  return (
    <span className="mt-1 block w-32">
      <StackedBar counts={counts} />
    </span>
  )
}

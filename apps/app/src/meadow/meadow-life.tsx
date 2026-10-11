/**
 * The life cycle on a verb's flower before its butterfly: eggs on a leaf, a caterpillar that
 * grows, then a chrysalis. Same frame, outline and eyes as the butterfly (52 × 44).
 */
import type { MeadowLife as Life } from '@little-tables/engine/schema'
import { cn } from '@little-tables/ui'

const line = '#5A3D26'
const leaf = '#9CC46A'
const vein = '#6E9A3E'
const egg = '#FFF4D2'
const body = '#A8D872'
const bodyLight = '#C2E58E'
const spot = '#F99A54'
const eye = '#4F2910'
const cheek = '#F7AB7D'
const shell = '#C4D489'
const band = '#8FA35A'
const gold = '#E8B84A'
const twig = '#8A6A44'

function Eggs() {
  return (
    <>
      <path
        d="M5 34c8-12 28-15 42-6-10 10-28 13-42 6z"
        fill={leaf}
        stroke={line}
        strokeWidth={0.74}
      />
      <path d="M9 33c10-3 22-4 33-4" fill="none" stroke={vein} strokeWidth={0.6} />
      {eggs.map(([cx, cy]) => (
        <g key={cx}>
          <ellipse cx={cx} cy={cy} fill={egg} rx={2.7} ry={3.3} stroke={line} strokeWidth={0.6} />
          <ellipse cx={cx - 0.8} cy={cy - 1.2} fill="#ffffff" rx={0.6} ry={0.9} />
        </g>
      ))}
    </>
  )
}

/** `x y r` of a round segment. */
type Ring = readonly [number, number, number]

const rings = (xs: ReadonlyArray<number>, low: number, high: number, r: number) =>
  xs.map((x, index): Ring => [x, index % 2 ? high : low, r])

/** Segments from tail to head; the big caterpillar has more, and larger. */
const segments: Readonly<
  Record<'big' | 'small', Readonly<{ head: Ring; rings: ReadonlyArray<Ring> }>>
> = {
  big: { head: [41, 24, 5.4], rings: rings([8, 14.5, 21, 27.5, 34], 30.5, 28, 4.4) },
  small: { head: [33, 27, 4.4], rings: rings([15, 21, 27], 31, 29.5, 3.6) },
}

const eggs: ReadonlyArray<readonly [number, number]> = [
  [19, 26.5],
  [25.5, 24.5],
  [32, 26],
]

function Caterpillar({ asleep, big }: Readonly<{ asleep: boolean; big: boolean }>) {
  const { head, rings: trail } = big ? segments.big : segments.small
  const [hx, hy, hr] = head
  return (
    <>
      {trail.map(([x, y, r], index) => (
        <g key={x}>
          <path
            d={`M${x - r * 0.4} ${y + r * 0.8}l-0.6 1.6M${x + r * 0.4} ${y + r * 0.8}l0.6 1.6`}
            stroke={line}
            strokeWidth={0.6}
          />
          <circle
            cx={x}
            cy={y}
            fill={index % 2 ? bodyLight : body}
            r={r}
            stroke={line}
            strokeWidth={0.74}
          />
          {index % 2 ? <circle cx={x} cy={y - r * 0.45} fill={spot} r={r * 0.22} /> : null}
        </g>
      ))}
      <path
        d={`M${hx - hr * 0.35} ${hy - hr * 0.85}l-1.4-${hr * 0.7}M${hx + hr * 0.35} ${hy - hr * 0.85}l1.4-${hr * 0.7}`}
        stroke={line}
        strokeWidth={0.6}
      />
      <circle cx={hx} cy={hy} fill={body} r={hr} stroke={line} strokeWidth={0.74} />
      {asleep ? (
        <>
          <path
            d={`M${hx - hr * 0.55} ${hy - 0.2}q0.6 0.6 1.2 0M${hx + hr * 0.15} ${hy - 0.2}q0.6 0.6 1.2 0`}
            fill="none"
            stroke={eye}
            strokeWidth={0.55}
          />
          <text fill={line} fontSize={6} fontWeight={700} x={hx + hr * 0.6} y={hy - hr * 1.1}>
            z
          </text>
        </>
      ) : (
        [hx - hr * 0.35, hx + hr * 0.35].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={hy - 0.4} fill={eye} rx={0.6} ry={0.8} />
            <circle cx={x + 0.25} cy={hy - 0.7} fill="#ffffff" r={0.2} />
          </g>
        ))
      )}
      <ellipse cx={hx - hr * 0.6} cy={hy + hr * 0.35} fill={cheek} rx={0.6} ry={0.45} />
      <ellipse cx={hx + hr * 0.6} cy={hy + hr * 0.35} fill={cheek} rx={0.6} ry={0.45} />
    </>
  )
}

function Chrysalis() {
  return (
    <>
      <path d="M12 6h28" stroke={twig} strokeWidth={1.8} />
      <path d="M26 6v4" stroke={line} strokeWidth={0.6} />
      <path
        d="M26 10c7 6 7 20 2 28-1 2-3 2-4 0-5-8-5-22 2-28z"
        fill={shell}
        stroke={line}
        strokeWidth={0.74}
      />
      <path
        d="M21.6 20q4.4 3 8.8 0M21.2 27q4.8 3 9.6 0"
        fill="none"
        stroke={band}
        strokeWidth={0.6}
      />
      <circle cx={24} cy={16} fill={gold} r={0.8} />
      <circle cx={28} cy={16} fill={gold} r={0.8} />
    </>
  )
}

/** Nothing for an empty cycle. */
export function MeadowLife({
  asleep = false,
  className,
  life,
}: Readonly<{ asleep?: boolean; className?: string; life: Life }>) {
  if (life === 'empty') return null
  return (
    <svg
      aria-hidden
      className={cn('h-9 w-[2.62rem]', className)}
      data-life={life}
      viewBox="0 0 52 44"
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {life === 'eggs' ? <Eggs /> : null}
        {life === 'caterpillar' || life === 'big-caterpillar' ? (
          <Caterpillar asleep={asleep} big={life === 'big-caterpillar'} />
        ) : null}
        {life === 'chrysalis' ? <Chrysalis /> : null}
      </g>
    </svg>
  )
}

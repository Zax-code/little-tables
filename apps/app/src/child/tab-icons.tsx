/**
 * The tab bar's drawings, kept from the previous app: a little house, a sprout in its pot and a
 * row of growing flowers. Lines follow the tab's colour; the fills are the garden's.
 */
const pinkFill = 'fill-[var(--garden-bloom-pink)]'
const softFill = 'fill-[var(--garden-bloom-soft-pink)]'
const mintFill = 'fill-[var(--garden-bloom-mint)]'

const petals = [
  [21, 5.7],
  [23.7, 7.6],
  [22.7, 10.6],
  [19.3, 10.6],
  [18.3, 7.6],
] as const

export type TabIconName = 'garden' | 'home' | 'progress'

export function TabIcon({ name }: Readonly<{ name: TabIconName }>) {
  return (
    <svg
      aria-hidden
      // The previous app drew them at 27 px; the tab bar sizes icons smaller by default.
      className="size-7! fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round]"
      strokeWidth={1.8}
      viewBox="0 0 28 28"
    >
      {name === 'home' ? (
        <>
          <path d="M5.2 12.7 14 5.2l8.8 7.5" />
          <path className="fill-surface" d="M7 11.5v10.8h14V11.5" />
          <circle
            className="fill-[var(--garden-bloom-home-pink)]"
            cx="11"
            cy="15.3"
            r="1.75"
            strokeWidth={1.35}
          />
          <path
            className="fill-surface-2"
            d="M15.3 22.3v-6.9c0-.8.6-1.4 1.4-1.4h1.7c.8 0 1.4.6 1.4 1.4v6.9"
            strokeWidth={1.45}
          />
          <circle className="fill-current stroke-none" cx="18.25" cy="18.25" r=".55" />
        </>
      ) : name === 'garden' ? (
        <>
          <path d="M14 16.1V10" strokeWidth={1.7} />
          <path
            className={mintFill}
            d="M13.9 12.7c-3.2.1-5.1-1.5-5.1-4.2 3.1-.2 5 1.4 5.1 4.2Z"
            strokeWidth={1.35}
          />
          <path
            className="fill-[var(--garden-leaf-soft)]"
            d="M14.1 10.5c.2-2.6 1.8-4 4.5-4-.1 2.7-1.8 4.1-4.5 4Z"
            strokeWidth={1.35}
          />
          <path className={pinkFill} d="M7.2 16.1h13.6l-1.5 7.2H8.7l-1.5-7.2Z" strokeWidth={1.6} />
          <path
            className={softFill}
            d="M6.4 15.2c0-.7.6-1.2 1.3-1.2h12.6c.7 0 1.3.5 1.3 1.2v1.1H6.4v-1.1Z"
            strokeWidth={1.55}
          />
          <path
            className="stroke-[var(--garden-pot-detail)]"
            d="M10.2 19.4h7.6"
            strokeWidth={1.25}
          />
        </>
      ) : (
        <>
          <path d="M3.8 23h20.4" />
          <path d="M7 22.4v-5.8M14 22.4v-9.2M21 22.4V11" strokeWidth={1.75} />
          <path
            className={mintFill}
            d="M7 19.3c-2.3 0-3.4-1.1-3.4-3.1 2.2 0 3.4 1.1 3.4 3.1ZM7 17.6c0-2 1.1-3 3.3-3 0 2-1.1 3-3.3 3ZM14 17.7c2.1 0 3.2-1 3.2-2.9-2.1 0-3.2 1-3.2 2.9ZM21 16.6c-2.1 0-3.2-1-3.2-2.9 2.1 0 3.2 1 3.2 2.9Z"
            strokeWidth={1.15}
          />
          <path
            className={pinkFill}
            d="M11.6 12.5c.3-2.1 1.2-3.3 2.4-3.3s2.1 1.2 2.4 3.3c-.7 1.1-1.5 1.6-2.4 1.6s-1.7-.5-2.4-1.6Z"
            strokeWidth={1.25}
          />
          {petals.map(([cx, cy]) => (
            <circle
              className={softFill}
              cx={cx}
              cy={cy}
              key={`${cx}-${cy}`}
              r="2.1"
              strokeWidth={1.05}
            />
          ))}
          <circle
            className="fill-[var(--garden-center-yellow)]"
            cx="21"
            cy="8.4"
            r="1.65"
            strokeWidth={1.05}
          />
        </>
      )}
    </svg>
  )
}

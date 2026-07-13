import { Link, useRouterState } from '@tanstack/react-router'

const items = [
  { label: 'home', path: '/', symbol: '⌂' },
  { label: 'garden', path: '/garden', symbol: '✿' },
  { label: 'stats', path: '/stats', symbol: '▥' },
] as const

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <nav aria-label="Main navigation" className="bottom-nav">
      {items.map((item) => (
        <Link
          aria-current={pathname === item.path ? 'page' : undefined}
          className="nav-item"
          key={item.path}
          to={item.path}
        >
          <span aria-hidden="true" className="nav-symbol">
            {item.symbol}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

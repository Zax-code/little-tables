import { Link, useRouterState } from '@tanstack/react-router'

const items = [
  { icon: 'home', label: 'home', path: '/' },
  { icon: 'garden', label: 'garden', path: '/garden' },
  { icon: 'stats', label: 'stats', path: '/stats' },
] as const

type NavIconName = (typeof items)[number]['icon']

function NavIcon({ name }: Readonly<{ name: NavIconName }>) {
  if (name === 'home') {
    return (
      <svg aria-hidden="true" className="nav-symbol" viewBox="0 0 28 28">
        <path d="M4.5 13.2 14 4.8l9.5 8.4v10H17v-6.4h-6v6.4H4.5Z" />
      </svg>
    )
  }
  if (name === 'garden') {
    return (
      <svg aria-hidden="true" className="nav-symbol" viewBox="0 0 28 28">
        <path d="M14 11.1c-1.8-4.9 4.4-7.4 5.3-2.6 4.7-1.4 6.3 5.1 1.3 5.6 1.8 4.7-4.3 7-6.6 2.7-2.3 4.3-8.4 2-6.6-2.7-5-.5-3.4-7 1.3-5.6.9-4.8 7.1-2.3 5.3 2.6Z" />
        <circle cx="14" cy="13.1" r="2.7" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" className="nav-symbol" viewBox="0 0 28 28">
      <path d="M5 23V14h4v9M12 23V7h4v16M19 23V11h4v12M3.5 23.5h21" />
    </svg>
  )
}

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
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}

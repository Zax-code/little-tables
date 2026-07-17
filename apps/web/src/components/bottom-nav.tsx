import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import type { MouseEvent } from 'react'

import { useFlowerTransition } from '../flower-transition.js'
import { transitionBetweenTabs } from '../tab-navigation.js'

import { useI18n } from '../i18n.js'

const items = [
  { icon: 'home', label: 'nav.home', path: '/' },
  { icon: 'garden', label: 'nav.garden', path: '/garden' },
  { icon: 'stats', label: 'nav.stats', path: '/stats' },
] as const

type NavIconName = (typeof items)[number]['icon']

function NavIcon({ name }: Readonly<{ name: NavIconName }>) {
  if (name === 'home') {
    return (
      <svg aria-hidden="true" className="nav-symbol" viewBox="0 0 28 28">
        <path d="M5.2 12.7 14 5.2l8.8 7.5" />
        <path className="nav-symbol__surface" d="M7 11.5v10.8h14V11.5" />
        <circle className="nav-symbol__home-window" cx="11" cy="15.3" r="1.75" />
        <path
          className="nav-symbol__home-door"
          d="M15.3 22.3v-6.9c0-.8.6-1.4 1.4-1.4h1.7c.8 0 1.4.6 1.4 1.4v6.9"
        />
        <circle className="nav-symbol__ink" cx="18.25" cy="18.25" r=".55" />
      </svg>
    )
  }
  if (name === 'garden') {
    return (
      <svg aria-hidden="true" className="nav-symbol" viewBox="0 0 28 28">
        <path className="nav-symbol__garden-stem" d="M14 16.1V10" />
        <path
          className="nav-symbol__garden-leaf nav-symbol__leaf"
          d="M13.9 12.7c-3.2.1-5.1-1.5-5.1-4.2 3.1-.2 5 1.4 5.1 4.2Z"
        />
        <path
          className="nav-symbol__garden-leaf nav-symbol__garden-soft"
          d="M14.1 10.5c.2-2.6 1.8-4 4.5-4-.1 2.7-1.8 4.1-4.5 4Z"
        />
        <path
          className="nav-symbol__accent nav-symbol__garden-pot"
          d="M7.2 16.1h13.6l-1.5 7.2H8.7l-1.5-7.2Z"
        />
        <path
          className="nav-symbol__garden-rim nav-symbol__soft"
          d="M6.4 15.2c0-.7.6-1.2 1.3-1.2h12.6c.7 0 1.3.5 1.3 1.2v1.1H6.4v-1.1Z"
        />
        <path className="nav-symbol__pot-detail" d="M10.2 19.4h7.6" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" className="nav-symbol" viewBox="0 0 28 28">
      <path d="M3.8 23h20.4" />
      <path className="nav-symbol__progress-stems" d="M7 22.4v-5.8M14 22.4v-9.2M21 22.4V11" />
      <path
        className="nav-symbol__leaf"
        d="M7 19.3c-2.3 0-3.4-1.1-3.4-3.1 2.2 0 3.4 1.1 3.4 3.1ZM7 17.6c0-2 1.1-3 3.3-3 0 2-1.1 3-3.3 3ZM14 17.7c2.1 0 3.2-1 3.2-2.9-2.1 0-3.2 1-3.2 2.9ZM21 16.6c-2.1 0-3.2-1-3.2-2.9 2.1 0 3.2 1 3.2 2.9Z"
      />
      <path
        className="nav-symbol__accent"
        d="M11.6 12.5c.3-2.1 1.2-3.3 2.4-3.3s2.1 1.2 2.4 3.3c-.7 1.1-1.5 1.6-2.4 1.6s-1.7-.5-2.4-1.6Z"
      />
      <circle className="nav-symbol__progress-petal nav-symbol__soft" cx="21" cy="5.7" r="2.1" />
      <circle className="nav-symbol__progress-petal nav-symbol__soft" cx="23.7" cy="7.6" r="2.1" />
      <circle className="nav-symbol__progress-petal nav-symbol__soft" cx="22.7" cy="10.6" r="2.1" />
      <circle className="nav-symbol__progress-petal nav-symbol__soft" cx="19.3" cy="10.6" r="2.1" />
      <circle className="nav-symbol__progress-petal nav-symbol__soft" cx="18.3" cy="7.6" r="2.1" />
      <circle className="nav-symbol__center" cx="21" cy="8.4" r="1.65" />
    </svg>
  )
}

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  const transition = useFlowerTransition()
  const { t } = useI18n()
  const isCurrent = (path: (typeof items)[number]['path']) =>
    pathname === path || (path === '/garden' && pathname.startsWith('/garden/'))

  const changeTab = (
    event: MouseEvent<HTMLAnchorElement>,
    path: (typeof items)[number]['path'],
  ) => {
    void transitionBetweenTabs({
      currentPath: pathname,
      event,
      navigate: () => navigate({ to: path }),
      nextPath: path,
      transition,
    })
  }

  return (
    <nav aria-label={t('nav.label')} className="bottom-nav">
      <p aria-hidden="true" className="nav-brand">
        little tables<span>.</span>
      </p>
      {items.map((item) => (
        <Link
          aria-current={isCurrent(item.path) ? 'page' : undefined}
          className="nav-item"
          data-nav-tab={item.icon}
          key={item.path}
          onClick={(event) => changeTab(event, item.path)}
          preload="render"
          to={item.path}
        >
          <NavIcon name={item.icon} />
          <span>{t(item.label)}</span>
        </Link>
      ))}
    </nav>
  )
}

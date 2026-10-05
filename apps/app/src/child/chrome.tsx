/** The child space's frame: profile pill, parent lock and tab bar (mockups R1). */
import { IconButton, TabBar, TabBarItem } from '@little-tables/ui'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { ChartColumn, ChevronDown, Lock, Sprout, Sun } from 'lucide-react'
import { useState } from 'react'

import { useApp } from '../app/app-context.js'
import { avatarImage, characterOf } from '../characters/characters.js'
import { useI18n } from '../i18n/i18n.js'
import { WhoPlaysSheet } from './who-plays-sheet.js'

export function ChildTopBar() {
  const { activeProfile } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [choosing, setChoosing] = useState(false)
  return (
    <div className="flex items-center justify-between px-4 pt-2 pb-1">
      <button
        aria-label={t('chrome.whoPlays', { name: activeProfile.name })}
        className="flex min-h-11 items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 shadow-[0_1px_3px_var(--lt-shadow)]"
        onClick={() => setChoosing(true)}
        type="button"
      >
        <img
          alt=""
          className="size-8 rounded-full bg-surface-2 object-cover"
          height={32}
          src={avatarImage(characterOf(activeProfile.avatarId))}
          width={32}
        />
        <span className="text-subhead font-extrabold">{activeProfile.name}</span>
        <ChevronDown aria-hidden className="size-4 text-label-2" />
      </button>
      <IconButton
        label={t('chrome.parents')}
        onClick={() => void navigate({ to: '/parents' })}
        tone="surface"
      >
        <Lock aria-hidden className="size-5" />
      </IconButton>
      <WhoPlaysSheet onOpenChange={setChoosing} open={choosing} />
    </div>
  )
}

export function ChildTabBar() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const tabs = [
    { icon: <Sun />, label: t('tabs.today'), to: '/' },
    { icon: <Sprout />, label: t('tabs.garden'), to: '/garden' },
    { icon: <ChartColumn />, label: t('tabs.progress'), to: '/progress' },
  ] as const
  return (
    <TabBar label={t('tabs.label')}>
      {tabs.map((tab) => (
        <TabBarItem
          active={tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to)}
          icon={tab.icon}
          key={tab.to}
          label={tab.label}
        >
          <Link to={tab.to} />
        </TabBarItem>
      ))}
    </TabBar>
  )
}

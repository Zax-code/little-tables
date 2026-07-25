import type { ChildProfile } from '@little-tables/domain'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { useI18n } from '../i18n.js'
import { characterSourcesForPath, resolveCharacter } from '../character-catalog.js'
import { preloadImageSources } from '../preload-images.js'
import { useFamilyProfile } from '../use-family-profile.js'
import { ProfileAvatar } from './profile-avatar.js'
import { profileSwitchDelay } from './profile-switch-transition.js'

export function ProfileSwitcher() {
  const { activeProfile, profiles, switchProfile } = useFamilyProfile()
  const navigate = useNavigate()
  const pathname = useLocation({ select: (location) => location.pathname })
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [pendingProfile, setPendingProfile] = useState<ChildProfile>()
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (pendingProfile === undefined) return
    if (pendingProfile.id !== activeProfile.id) {
      let cancelled = false
      const targetCharacter = resolveCharacter(pendingProfile.avatarId)
      const ready = preloadImageSources(characterSourcesForPath(targetCharacter, pathname))
      const commit = window.setTimeout(
        () => {
          void ready.then(() => {
            if (!cancelled) switchProfile(pendingProfile.id)
          })
        },
        profileSwitchDelay('commit', reducedMotion === true),
      )
      return () => {
        cancelled = true
        window.clearTimeout(commit)
      }
    }
    const finish = window.setTimeout(
      () => setPendingProfile(undefined),
      profileSwitchDelay('finish', reducedMotion === true),
    )
    return () => window.clearTimeout(finish)
  }, [activeProfile.id, pathname, pendingProfile, reducedMotion, switchProfile])

  return (
    <div className="profile-switcher">
      <button
        aria-busy={pendingProfile !== undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('family.switcherAria', { name: activeProfile.name })}
        className="profile-switcher-button"
        disabled={pendingProfile !== undefined}
        onClick={() => setOpen((visible) => !visible)}
        type="button"
      >
        <AnimatePresence initial={false} mode="wait">
          <m.span
            animate={{ opacity: 1, y: 0 }}
            className="profile-switcher-current"
            data-profile-id={activeProfile.id}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -5 }}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
            key={activeProfile.id}
            transition={{ duration: reducedMotion ? 0 : 0.14 }}
          >
            <ProfileAvatar avatarId={activeProfile.avatarId} />
            <span>{activeProfile.name}</span>
          </m.span>
        </AnimatePresence>
      </button>
      {open ? (
        <div aria-label={t('family.switcherMenu')} className="profile-switcher-menu" role="menu">
          {profiles.map((profile) => (
            <button
              aria-current={profile.id === activeProfile.id ? 'true' : undefined}
              key={profile.id}
              onClick={() => {
                setOpen(false)
                if (profile.id !== activeProfile.id) setPendingProfile(profile)
              }}
              role="menuitem"
              type="button"
            >
              <ProfileAvatar avatarId={profile.avatarId} />
              <span>{profile.name}</span>
              {profile.id === activeProfile.id ? <i aria-hidden="true">✓</i> : null}
            </button>
          ))}
          <button
            className="profile-manage-button"
            onClick={() => {
              setOpen(false)
              void navigate({ to: '/family' })
            }}
            role="menuitem"
            type="button"
          >
            <span aria-hidden="true">＋</span>
            <span>{t('family.manage')}</span>
          </button>
        </div>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {pendingProfile?.id === activeProfile.id
          ? t('family.switchedTo', { name: activeProfile.name })
          : ''}
      </span>
      <AnimatePresence>
        {pendingProfile !== undefined ? (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            aria-hidden="true"
            className="profile-switch-feedback"
            exit={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
            transition={{ duration: reducedMotion ? 0 : 0.14 }}
          >
            <ProfileAvatar avatarId={pendingProfile.avatarId} />
            <span>
              {pendingProfile.id === activeProfile.id
                ? t('family.switchedTo', { name: activeProfile.name })
                : t('family.switchingTo', { name: pendingProfile.name })}
            </span>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

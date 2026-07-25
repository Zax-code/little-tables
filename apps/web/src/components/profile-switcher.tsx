import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { useI18n } from '../i18n.js'
import { useFamilyProfile } from '../use-family-profile.js'
import { ProfileAvatar } from './profile-avatar.js'

export function ProfileSwitcher() {
  const { activeProfile, profiles, switchProfile } = useFamilyProfile()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="profile-switcher">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('family.switcherAria', { name: activeProfile.name })}
        className="profile-switcher-button"
        onClick={() => setOpen((visible) => !visible)}
        type="button"
      >
        <ProfileAvatar avatarId={activeProfile.avatarId} />
        <span>{activeProfile.name}</span>
      </button>
      {open ? (
        <div aria-label={t('family.switcherMenu')} className="profile-switcher-menu" role="menu">
          {profiles.map((profile) => (
            <button
              aria-current={profile.id === activeProfile.id ? 'true' : undefined}
              key={profile.id}
              onClick={() => {
                switchProfile(profile.id)
                setOpen(false)
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
    </div>
  )
}

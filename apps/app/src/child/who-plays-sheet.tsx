/** A6: switch between the family's children; the family itself is managed by a parent. */
import { cn, IconTile, ListGroup, ListRow, Sheet } from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'

import { useApp } from '../app/app-context.js'
import { avatarImage, characterOf } from '../characters/characters.js'
import { useI18n } from '../i18n/i18n.js'

type WhoPlaysSheetProps = Readonly<{ onOpenChange: (open: boolean) => void; open: boolean }>

export function WhoPlaysSheet({ onOpenChange, open }: WhoPlaysSheetProps) {
  const { activeProfile, family, selectProfile } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <Sheet onOpenChange={onOpenChange} open={open} title={t('whoPlays.title')}>
      <ul className="grid grid-cols-3 gap-3">
        {family.profiles.map((profile) => {
          const selected = profile.id === activeProfile.id
          return (
            <li key={profile.id}>
              <button
                aria-pressed={selected}
                className={cn(
                  'flex w-full flex-col items-center gap-2 rounded-card border-2 bg-surface px-2 py-3 transition-colors',
                  selected ? 'border-tint bg-tint-soft' : 'border-transparent',
                )}
                onClick={() => {
                  selectProfile(profile.id)
                  onOpenChange(false)
                }}
                type="button"
              >
                <img
                  alt=""
                  className="size-16 object-contain"
                  height={64}
                  src={avatarImage(characterOf(profile.avatarId))}
                  width={64}
                />
                <span className={cn('text-subhead font-extrabold', selected && 'text-tint')}>
                  {profile.name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <ListGroup>
        <ListRow
          detail={t('whoPlays.parents')}
          leading={
            <IconTile className="bg-label-2">
              <Lock aria-hidden />
            </IconTile>
          }
          onClick={() => {
            onOpenChange(false)
            void navigate({ to: '/parents' })
          }}
          title={t('whoPlays.manage')}
          trailing="chevron"
        />
      </ListGroup>
    </Sheet>
  )
}

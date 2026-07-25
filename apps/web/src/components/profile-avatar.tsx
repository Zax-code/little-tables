import type { ChildAvatarId } from '@little-tables/domain'

import { resolveCharacter } from '../character-catalog.js'

export function ProfileAvatar({
  avatarId,
  className = '',
}: Readonly<{ avatarId: ChildAvatarId; className?: string }>) {
  const character = resolveCharacter(avatarId)
  return (
    <span
      aria-hidden="true"
      className={`profile-avatar profile-avatar-${avatarId} ${className}`.trim()}
      data-avatar-character={character.id}
    >
      <img
        alt=""
        className={character.id === 'miffy' ? 'profile-avatar__miffy' : 'profile-avatar__character'}
        data-avatar-artwork={character.id}
        draggable={false}
        height={character.avatar.height}
        src={character.avatar.src}
        width={character.avatar.width}
      />
    </span>
  )
}

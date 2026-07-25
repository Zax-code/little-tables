import type { ChildAvatarId } from '@little-tables/domain'

const glyphs = {
  berry: '♥',
  bluebell: '✿',
  sprout: '●',
  sunbeam: '✦',
} as const satisfies Readonly<Record<ChildAvatarId, string>>

export function ProfileAvatar({
  avatarId,
  className = '',
}: Readonly<{ avatarId: ChildAvatarId; className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={`profile-avatar profile-avatar-${avatarId} ${className}`.trim()}
    >
      {glyphs[avatarId]}
    </span>
  )
}

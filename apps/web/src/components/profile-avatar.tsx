import type { ChildAvatarId } from '@little-tables/domain'

const avatarCharacters = {
  berry: { character: 'pip-mouse', variant: 'berry' },
  bluebell: { character: 'pip-mouse', variant: 'sage' },
  sprout: { character: 'miffy', variant: 'coral' },
  sunbeam: { character: 'miffy', variant: 'sunshine' },
} as const satisfies Readonly<
  Record<ChildAvatarId, Readonly<{ character: 'miffy' | 'pip-mouse'; variant: string }>>
>

export function ProfileAvatar({
  avatarId,
  className = '',
}: Readonly<{ avatarId: ChildAvatarId; className?: string }>) {
  const avatar = avatarCharacters[avatarId]
  return (
    <span
      aria-hidden="true"
      className={`profile-avatar profile-avatar-${avatarId} ${className}`.trim()}
      data-avatar-character={avatar.character}
      data-avatar-variant={avatar.variant}
    >
      {avatar.character === 'miffy' ? (
        <img
          alt=""
          className="profile-avatar__miffy"
          draggable={false}
          src="/generated/miffy-google-connect.webp"
        />
      ) : (
        <svg
          className="profile-avatar__mouse"
          fill="none"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle className="profile-avatar__mouse-ear" cx="15" cy="18" r="11" />
          <circle className="profile-avatar__mouse-ear" cx="49" cy="18" r="11" />
          <circle className="profile-avatar__mouse-ear-inner" cx="15" cy="18" r="5" />
          <circle className="profile-avatar__mouse-ear-inner" cx="49" cy="18" r="5" />
          <path
            className="profile-avatar__mouse-face"
            d="M54 35c0 14-10 23-22 23S10 49 10 35c0-12 10-21 22-21s22 9 22 21Z"
          />
          <circle className="profile-avatar__mouse-eye" cx="24" cy="34" r="2" />
          <circle className="profile-avatar__mouse-eye" cx="40" cy="34" r="2" />
          <path className="profile-avatar__mouse-nose" d="m29 41 3-2 3 2-3 3-3-3Z" />
          <path className="profile-avatar__mouse-mouth" d="M32 44c-1 3-4 4-6 3m6-3c1 3 4 4 6 3" />
          <path
            className="profile-avatar__mouse-whisker"
            d="M21 41 8 38m13 7L8 47m35-6 13-3m-13 7 13 2"
          />
          <path
            className="profile-avatar__mouse-scarf"
            d="M21 53c7 3 15 3 22 0l-3 7-8-3-8 3-3-7Z"
          />
        </svg>
      )}
    </span>
  )
}

import type { ChildAvatarId } from '@little-tables/domain'

type AvatarCharacter = 'colin' | 'fenna' | 'malo' | 'miffy' | 'mina' | 'paco'

const avatarCharacters = {
  berry: 'miffy',
  bluebell: 'miffy',
  'colin-mallard': 'colin',
  'fenna-fox': 'fenna',
  'malo-bear': 'malo',
  'mina-cat': 'mina',
  'paco-dog': 'paco',
  sprout: 'miffy',
  sunbeam: 'miffy',
} as const satisfies Readonly<Record<ChildAvatarId, AvatarCharacter>>

const generatedAvatarAssets = {
  colin: '/avatars/colin-mallard.png',
  fenna: '/avatars/fenna-fox.png',
  malo: '/avatars/malo-bear.png',
  mina: '/avatars/mina-cat.png',
  paco: '/avatars/paco-dog.png',
} as const satisfies Readonly<Record<Exclude<AvatarCharacter, 'miffy'>, string>>

export function ProfileAvatar({
  avatarId,
  className = '',
}: Readonly<{ avatarId: ChildAvatarId; className?: string }>) {
  const character = avatarCharacters[avatarId]
  return (
    <span
      aria-hidden="true"
      className={`profile-avatar profile-avatar-${avatarId} ${className}`.trim()}
      data-avatar-character={character}
    >
      {character === 'miffy' ? (
        <img alt="" className="profile-avatar__miffy" draggable={false} src="/avatars/miffy.png" />
      ) : (
        <img
          alt=""
          className="profile-avatar__character"
          data-avatar-artwork={character}
          draggable={false}
          src={generatedAvatarAssets[character]}
        />
      )}
    </span>
  )
}

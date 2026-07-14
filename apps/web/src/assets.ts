export type CharacterScene =
  'celebration' | 'home' | 'practice' | 'practiceCorrect' | 'practiceEncourage'

type CharacterAsset = Readonly<{
  alt: string
  source: 'gpt-image-built-in'
  src: string
}>

export const googleConnectIcon: CharacterAsset = {
  alt: 'Miffy face',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-google-connect.png',
}

export const gardenWateringSprite: CharacterAsset = {
  alt: 'Miffy tipping her blue watering can over the garden plants',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-garden-watering-sprite.png',
}

export const gardenWalkingSprite: CharacterAsset = {
  alt: 'Miffy walking through the garden with her blue watering can',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-garden-walking-sprite.png',
}

export const celebrationSprite = {
  alt: 'Miffy making a small joyful hop',
  src: '/generated/miffy-celebration-sprite-simple.png',
} as const

export const characterAssets: Readonly<Record<CharacterScene, CharacterAsset>> = {
  celebration: {
    alt: 'Miffy making a joyful little jump',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-celebration.png',
  },
  home: {
    alt: 'Miffy holding a red tulip',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-home.png',
  },
  practice: {
    alt: 'Miffy peeking over the bottom of the question',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice.png',
  },
  practiceCorrect: {
    alt: 'Miffy popping up with a happy little cheer',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice-correct.png',
  },
  practiceEncourage: {
    alt: 'Miffy popping up with a calm, thoughtful pose',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice-encourage.png',
  },
}

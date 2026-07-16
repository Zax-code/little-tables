export type CharacterScene = 'home' | 'practice' | 'practiceCorrect' | 'practiceEncourage'

type CharacterAsset = Readonly<{
  alt: string
  source: 'gpt-image-built-in'
  src: string
}>

export const googleConnectIcon: CharacterAsset = {
  alt: 'Miffy face',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-google-connect.webp',
}

export const gardenWateringSprite: CharacterAsset = {
  alt: 'Miffy tipping her blue watering can over the garden plants',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-garden-watering-sprite.webp',
}

export const gardenWalkingSprite: CharacterAsset = {
  alt: 'Miffy walking through the garden with her blue watering can',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-garden-walking-sprite.webp',
}

export const celebrationSprite = {
  alt: 'Miffy making a small joyful hop',
  src: '/generated/miffy-celebration-sprite-simple.webp',
} as const

export const characterAssets: Readonly<Record<CharacterScene, CharacterAsset>> = {
  home: {
    alt: 'Miffy holding a red tulip',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-home.webp',
  },
  practice: {
    alt: 'Miffy peeking over the bottom of the question',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice.webp',
  },
  practiceCorrect: {
    alt: 'Miffy popping up with a happy little cheer',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice-correct.webp',
  },
  practiceEncourage: {
    alt: 'Miffy popping up with a calm, thoughtful pose',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice-encourage.webp',
  },
}

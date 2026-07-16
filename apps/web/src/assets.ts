import type { TranslationKey } from './i18n.js'

export type CharacterScene = 'home' | 'practice' | 'practiceCorrect' | 'practiceEncourage'

type CharacterAsset = Readonly<{
  altKey: TranslationKey
  source: 'gpt-image-built-in'
  src: string
}>

export const googleConnectIcon: CharacterAsset = {
  altKey: 'asset.google',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-google-connect.webp',
}

export const gardenWateringSprite: CharacterAsset = {
  altKey: 'asset.watering',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-garden-watering-sprite.webp',
}

export const gardenWalkingSprite: CharacterAsset = {
  altKey: 'asset.walking',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-garden-walking-sprite.webp',
}

export const celebrationSprite = {
  altKey: 'asset.celebration',
  src: '/generated/miffy-celebration-sprite-simple.webp',
} as const

export const updateRecoveryAsset: CharacterAsset = {
  altKey: 'asset.updateRecovery',
  source: 'gpt-image-built-in',
  src: '/generated/miffy-update-recovery-v3.webp',
}

export const characterAssets: Readonly<Record<CharacterScene, CharacterAsset>> = {
  home: {
    altKey: 'asset.home',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-home.webp',
  },
  practice: {
    altKey: 'asset.practice',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice.webp',
  },
  practiceCorrect: {
    altKey: 'asset.practiceCorrect',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice-correct.webp',
  },
  practiceEncourage: {
    altKey: 'asset.practiceEncourage',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-practice-encourage.webp',
  },
}

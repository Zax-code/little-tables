export type CharacterScene =
  'celebration' | 'garden' | 'home' | 'practice' | 'practiceCorrect' | 'practiceEncourage'

type CharacterAsset = Readonly<{
  alt: string
  source: 'gpt-image-built-in'
  src: string
}>

export const characterAssets: Readonly<Record<CharacterScene, CharacterAsset>> = {
  celebration: {
    alt: 'Miffy making a joyful little jump',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-celebration.png',
  },
  garden: {
    alt: 'Miffy watering a pink tulip',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-garden.png',
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

export type CharacterScene = 'celebration' | 'garden' | 'home' | 'practice'

type CharacterAsset = Readonly<{
  alt: string
  source: 'gpt-image-built-in'
  src: string
}>

export const characterAssets: Readonly<Record<CharacterScene, CharacterAsset>> = {
  celebration: {
    alt: 'Miffy jumping happily among pink flowers',
    source: 'gpt-image-built-in',
    src: '/generated/miffy-celebration.png',
  },
  garden: {
    alt: 'Miffy watering a little garden of tulips and daisies',
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
}

import { describe, expect, it } from 'vitest'

import englishManifest from '../public/manifest-en.webmanifest?raw'
import frenchManifest from '../public/manifest-fr.webmanifest?raw'
import simplifiedChineseManifest from '../public/manifest-zh-Hans.webmanifest?raw'

const manifests = {
  en: englishManifest,
  fr: frenchManifest,
  'zh-Hans': simplifiedChineseManifest,
} as const

const readManifest = (locale: keyof typeof manifests): Promise<unknown> =>
  Promise.resolve(JSON.parse(manifests[locale]))

describe('install manifest content', () => {
  it('provides localized metadata for every selectable app language', async () => {
    await expect(readManifest('en')).resolves.toMatchObject({
      description: 'Gentle multiplication practice for a little garden that grows with you.',
      lang: 'en',
      name: 'little tables.',
    })
    await expect(readManifest('fr')).resolves.toMatchObject({
      description: 'De toutes petites séances de calcul pour faire pousser un joli jardin.',
      lang: 'fr',
      name: 'little tables.',
    })
    await expect(readManifest('zh-Hans')).resolves.toMatchObject({
      description: '轻轻松松练乘法，陪你的小花园慢慢长大。',
      lang: 'zh-Hans',
      name: 'little tables.',
    })
  })

  it('does not expose French screenshots in the English or Chinese install sheets', async () => {
    await expect(readManifest('en')).resolves.not.toHaveProperty('screenshots')
    await expect(readManifest('zh-Hans')).resolves.not.toHaveProperty('screenshots')
    await expect(readManifest('fr')).resolves.toHaveProperty('screenshots')
  })
})

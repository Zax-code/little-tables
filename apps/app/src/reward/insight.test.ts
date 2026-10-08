import { describe, expect, it } from 'vitest'

import { createTranslator } from '../i18n/translator.js'
import { insightCopy } from './insight.js'

const fr = createTranslator('fr')
const rooted = (factKeys: ReadonlyArray<string>) =>
  insightCopy({ count: factKeys.length, factKeys, kind: 'facts-became-fluent' }, fr)

describe('the insight of a session', () => {
  it('names the verb and its tense when one verb took root', () => {
    expect(rooted(['conj:aller:future'])).toBe('Tu sais conjuguer « aller » au futur.')
    expect(rooted(['conj:connaître:imperfect'])).toBe(
      'Tu sais conjuguer « connaitre » à l’imparfait.',
    )
    expect(rooted(['conj:aller:present', 'conj:aller:future'])).toBe('Tu sais conjuguer « aller ».')
  })

  it('counts the facts otherwise', () => {
    expect(rooted(['conj:aller:future', 'conj:finir:future'])).toBe(
      '2 calculs sont maintenant bien enracinés.',
    )
    expect(rooted(['conj:aller:future', '7:8'])).toBe('2 calculs sont maintenant bien enracinés.')
    expect(rooted(['7:8'])).toBe('Un calcul est maintenant bien enraciné.')
  })
})

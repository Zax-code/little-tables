import { describe, expect, it } from 'vitest'

import {
  displayVerb,
  isEquivalentForm,
  levelLabel,
  normalizeForm,
  onlyAccentsDiffer,
  withSubject,
} from './format.js'

describe('written forms', () => {
  it('names conjugation levels in French in every language', () => {
    expect(levelLabel('conj:finir:present', 'fr')).toBe('finir au présent')
    expect(levelLabel('conj:connaître:imperfect', 'en')).toBe('connaitre à l’imparfait')
    expect(levelLabel('conj:aller:compound-past', 'zh-Hans')).toBe('aller au passé composé')
  })

  it('tells a missing accent from a spelling mistake', () => {
    expect(onlyAccentsDiffer('suis alle', 'suis allé')).toBe(true)
    expect(onlyAccentsDiffer('suis allé', 'suis allé')).toBe(false)
    expect(onlyAccentsDiffer('finisent', 'finissent')).toBe(false)
    expect(normalizeForm(' Ils  Finissent ')).toBe('ils finissent')
  })

  it('shows a right form written another way, and joins subjects', () => {
    const description = { expected: { type: 'text', value: 'essaie' }, production: true } as const
    expect(isEquivalentForm(description, { type: 'text', value: 'essaye' })).toBe(true)
    expect(isEquivalentForm(description, { type: 'text', value: 'Essaie' })).toBe(false)
    expect(withSubject('j’', 'aime')).toBe('j’aime')
    expect(withSubject('ils', 'vont')).toBe('ils vont')
    expect(displayVerb('croître')).toBe('croître')
    expect(displayVerb('paraître')).toBe('paraitre')
  })
})

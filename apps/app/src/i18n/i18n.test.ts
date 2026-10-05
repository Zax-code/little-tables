import { describe, expect, it } from 'vitest'

import { createTranslator, interpolate } from './translator.js'
import { groups, messages } from './messages.js'

describe('catalogues', () => {
  it('never define a key in two groups', () => {
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const [name, group] of Object.entries(groups)) {
      for (const key of Object.keys(group.en)) {
        const owner = seen.get(key)
        if (owner !== undefined) duplicates.push(`${key} (${owner}, ${name})`)
        seen.set(key, name)
      }
    }
    expect(duplicates).toEqual([])
  })

  it('give every language the same placeholders', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort()
    const mismatches = Object.entries(messages.en).flatMap(([key, english]) =>
      (['fr', 'zh-Hans'] as const).flatMap((language) => {
        const translated = (messages[language] as Record<string, string>)[key] ?? ''
        return JSON.stringify(placeholders(translated)) === JSON.stringify(placeholders(english))
          ? []
          : [`${language} ${key}`]
      }),
    )
    expect(mismatches).toEqual([])
  })
})

describe('counted messages', () => {
  it('show the count in the singular, since French counts 0 as singular', () => {
    // Sentences only used for at least one item may say “one” in words.
    const missing = Object.entries(messages).flatMap(([language, catalogue]) =>
      Object.entries(catalogue).flatMap(([key, text]) =>
        key.endsWith('.one') && !key.startsWith('insight.') && !text.includes('{count}')
          ? [`${language} ${key}`]
          : [],
      ),
    )
    expect(missing).toEqual([])
    expect(createTranslator('fr').count('garden.flowers', 0)).toBe('0 fleur')
  })
})

describe('translator', () => {
  it('fills placeholders and picks plural forms', () => {
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}')
    const fr = createTranslator('fr')
    expect(fr.count('today.questionsLeft', 1)).toBe('Encore 1 question')
    expect(fr.count('today.questionsLeft', 3)).toBe('Encore 3 questions')
    expect(createTranslator('zh-Hans').count('today.questionsLeft', 3)).toBe('还剩 3 道题')
    expect(fr.number(1000)).toBe('1 000')
  })
})

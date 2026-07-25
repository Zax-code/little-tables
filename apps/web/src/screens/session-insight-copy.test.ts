import type { SessionInsight } from '@little-tables/domain'
import { describe, expect, it } from 'vitest'

import { sessionInsightCopy } from './session-insight-copy.js'

describe('sessionInsightCopy', () => {
  it('celebrates independent keypad retrieval without calling it a score', () => {
    const insight: SessionInsight = {
      count: 3,
      factKeys: ['6:7', '7:8', '8:9'],
      kind: 'keypad-recalls',
    }

    expect(sessionInsightCopy(insight, 'fr')).toBe('tu en as retrouvé 3 toute seule.')
  })

  it('names a recovered calculation in the learner language', () => {
    const insight: SessionInsight = {
      count: 1,
      factKeys: ['divide:56:7'],
      kind: 'mistakes-recovered',
    }

    expect(sessionInsightCopy(insight, 'en')).toBe('you found your way back to 56 ÷ 7.')
    expect(sessionInsightCopy(insight, 'zh-Hans')).toBe('你找回了 56 ÷ 7 的思路。')
  })
})

/** One thing that went well in a session, written for the child. */
import type { SessionInsight } from '@little-tables/engine/schema'

import type { Translator } from '../i18n/translator.js'
import { levelLabel } from '../session/format.js'

/** A fact as the child writes it: 7 × 8, 56 ÷ 7, or the name of a skill level. */
export const displayFact = (factKey: string, translator: Translator) => {
  const division = /^divide:(\d+):(\d+)$/.exec(factKey)
  if (division !== null) return `${division[1]} ÷ ${division[2]}`
  const multiplication = /^(\d+):(\d+)$/.exec(factKey)
  return multiplication === null
    ? levelLabel(factKey, translator.language)
    : `${multiplication[1]} × ${multiplication[2]}`
}

export const insightCopy = (insight: NonNullable<SessionInsight>, translator: Translator) => {
  switch (insight.kind) {
    case 'facts-became-fluent':
      return translator.count('insight.rooted', insight.count)
    case 'facts-became-familiar':
      return translator.count('insight.familiar', insight.count)
    case 'keypad-recalls':
      return translator.count('insight.recalled', insight.count)
    case 'mistakes-recovered':
      return translator.t('insight.recovered', {
        fact: displayFact(insight.factKeys[0] ?? '', translator),
      })
    default:
      return translator.t('insight.persisted')
  }
}

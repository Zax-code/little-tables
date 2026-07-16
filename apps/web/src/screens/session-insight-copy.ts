import type { SessionInsight } from '@little-tables/domain'

import { translate, type Locale } from '../i18n-catalog.js'

const displayFact = (factKey: string): string => {
  const division = /^divide:(\d+):(\d+)$/.exec(factKey)
  if (division !== null) return `${division[1]} ÷ ${division[2]}`
  const multiplication = /^(\d+):(\d+)$/.exec(factKey)
  return multiplication === null ? factKey : `${multiplication[1]} × ${multiplication[2]}`
}

export function sessionInsightCopy(insight: SessionInsight, locale: Locale): string {
  if (insight.kind === 'facts-became-fluent') {
    return translate(locale, insight.count === 1 ? 'insight.rootedOne' : 'insight.rootedMany', {
      count: insight.count,
    })
  }
  if (insight.kind === 'facts-became-familiar') {
    return translate(locale, insight.count === 1 ? 'insight.familiarOne' : 'insight.familiarMany', {
      count: insight.count,
    })
  }
  if (insight.kind === 'keypad-recalls') {
    return translate(locale, insight.count === 1 ? 'insight.recalledOne' : 'insight.recalledMany', {
      count: insight.count,
    })
  }
  if (insight.kind === 'mistakes-recovered') {
    return translate(locale, 'insight.recovered', {
      fact: displayFact(insight.factKeys[0] ?? ''),
    })
  }
  return translate(locale, 'insight.persisted')
}

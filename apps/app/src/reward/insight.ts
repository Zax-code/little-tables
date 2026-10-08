/** One thing that went well in a session, written for the child. */
import { tenses, type SessionInsight, type Tense } from '@little-tables/engine/schema'

import type { Translator } from '../i18n/translator.js'
import { displayVerb, levelLabel, tenseLabel } from '../session/format.js'

/** A fact as the child writes it: 7 × 8, 56 ÷ 7, or the name of a skill level. */
export const displayFact = (factKey: string, translator: Translator) => {
  const division = /^divide:(\d+):(\d+)$/.exec(factKey)
  if (division !== null) return `${division[1]} ÷ ${division[2]}`
  const multiplication = /^(\d+):(\d+)$/.exec(factKey)
  return multiplication === null
    ? levelLabel(factKey, translator.language)
    : `${multiplication[1]} × ${multiplication[2]}`
}

/** The verb and tenses when every key is a tense of one verb (`conj:aller:future`). */
const oneVerb = (factKeys: ReadonlyArray<string>) => {
  const parsed = factKeys.map((key) => /^conj:([^:]+):([a-z-]+)$/.exec(key))
  const verbs = new Set(parsed.map((match) => match?.[1]))
  const verb = parsed[0]?.[1]
  if (verb === undefined || verbs.size !== 1 || parsed.some((match) => match === null)) return null
  const keyTenses = new Set(parsed.map((match) => match?.[2]))
  return { tenses: tenses.filter((tense) => keyTenses.has(tense)), verb }
}

const rootedCopy = (factKeys: ReadonlyArray<string>, count: number, translator: Translator) => {
  const conjugated = oneVerb(factKeys)
  if (conjugated === null) return translator.count('insight.rooted', count)
  const verb = displayVerb(conjugated.verb)
  const [tense]: ReadonlyArray<Tense> = conjugated.tenses
  return conjugated.tenses.length === 1 && tense !== undefined
    ? translator.t('insight.verbRootedTense', {
        tense: tenseLabel(tense, translator.language),
        verb,
      })
    : translator.t('insight.verbRooted', { verb })
}

export const insightCopy = (insight: NonNullable<SessionInsight>, translator: Translator) => {
  switch (insight.kind) {
    case 'facts-became-fluent':
      return rootedCopy(insight.factKeys, insight.count, translator)
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

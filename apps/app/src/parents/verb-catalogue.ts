/**
 * The verb catalogue: reviewed sections shown first, and the whole Lefff index for the search,
 * loaded on demand from `/verbs/index.json` (`docs/conjugation/TECHNICAL_SPEC.md` §1.5).
 */
import {
  maxConjugationVerbs,
  tenses,
  type ConjugationSettings,
  type Tense,
} from '@little-tables/engine/schema'

import type { MessageKey } from '../i18n/translator.js'

export type Section = Readonly<{ title: MessageKey; verbs: ReadonlyArray<string> }>

/** The eight irregular verbs the CE2 programme names. */
export const programmeVerbs: ReadonlyArray<string> = [
  'aller',
  'faire',
  'dire',
  'venir',
  'pouvoir',
  'voir',
  'vouloir',
  'prendre',
]

export const sections: ReadonlyArray<Section> = [
  { title: 'verbs.section.programme', verbs: programmeVerbs },
  {
    title: 'verbs.section.second',
    verbs: [
      'finir',
      'choisir',
      'grandir',
      'réussir',
      'remplir',
      'obéir',
      'réfléchir',
      'rougir',
      'nourrir',
      'saisir',
      'bâtir',
      'applaudir',
      'ralentir',
      'atterrir',
      'avertir',
      'guérir',
      'punir',
      'agir',
      'réunir',
      'franchir',
      'fleurir',
      'vieillir',
      'salir',
      'blanchir',
      'noircir',
      'jaunir',
      'maigrir',
      'grossir',
      'bondir',
      'ravir',
    ],
  },
  {
    title: 'verbs.section.third',
    verbs: [
      'revenir',
      'devenir',
      'tenir',
      'apprendre',
      'comprendre',
      'refaire',
      'revoir',
      'apercevoir',
      'partir',
      'sortir',
      'dormir',
      'servir',
      'sentir',
      'courir',
      'lire',
      'écrire',
      'mettre',
      'boire',
      'savoir',
      'devoir',
      'croire',
      'vivre',
      'ouvrir',
      'offrir',
      'découvrir',
      'cueillir',
      'rendre',
      'attendre',
      'entendre',
      'descendre',
      'répondre',
      'perdre',
      'vendre',
      'connaître',
      'suivre',
      'recevoir',
      'rire',
      'sourire',
      'conduire',
      'construire',
      'plaire',
      'mourir',
      'naître',
      'peindre',
      'éteindre',
      'falloir',
      'pleuvoir',
    ],
  },
  {
    title: 'verbs.section.first',
    verbs: [
      'aimer',
      'chanter',
      'jouer',
      'parler',
      'marcher',
      'danser',
      'sauter',
      'regarder',
      'écouter',
      'trouver',
      'porter',
      'arriver',
      'entrer',
      'rester',
      'tomber',
      'manger',
      'commencer',
      'appeler',
      'jeter',
      'acheter',
      'lever',
      'préférer',
      'essayer',
      'payer',
      'envoyer',
      'nettoyer',
      'neiger',
    ],
  },
  { title: 'verbs.section.auxiliaries', verbs: ['être', 'avoir'] },
]

export type VerbGroupCode = '1' | '2' | '3' | 'aux'

export type VerbIndex = ReadonlyArray<readonly [string, VerbGroupCode]>

/** Lower case, no accents, so « reflechir » finds « réfléchir » and « connaitre » « connaître ». */
export const searchKey = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Verbs starting with the query first, then verbs containing it; at most `limit`. */
export const searchVerbs = (index: VerbIndex, query: string, limit = 20): ReadonlyArray<string> => {
  const wanted = searchKey(query)
  if (wanted === '') return []
  const starting: string[] = []
  const containing: string[] = []
  for (const [verb] of index) {
    const key = searchKey(verb)
    if (key.startsWith(wanted)) starting.push(verb)
    else if (key.includes(wanted)) containing.push(verb)
  }
  const byLength = (first: string, second: string) =>
    first.length - second.length || first.localeCompare(second, 'fr')
  return [...starting.sort(byLength), ...containing.sort(byLength)].slice(0, limit)
}

/** The whole index, fetched once; the service worker keeps it for offline visits. */
export const loadVerbIndex = async (): Promise<VerbIndex> => {
  const response = await fetch('/verbs/index.json')
  if (!response.ok) throw new Error(`verb index: ${response.status}`)
  const body = (await response.json()) as { verbs: VerbIndex }
  return body.verbs
}

/**
 * Ticks or unticks a tense. The compound past is half auxiliary: être and avoir come with it; a
 * verb put forward at a tense no longer ticked stays put forward as a whole.
 */
export const toggleTense = (
  conjugation: ConjugationSettings,
  tense: Tense,
): ConjugationSettings => {
  const ticked = new Set(conjugation.tenses)
  const on = !ticked.has(tense)
  const chosen = tenses.filter((candidate) => (candidate === tense ? on : ticked.has(candidate)))
  const auxiliaries =
    on && tense === 'compound-past'
      ? ['être', 'avoir'].filter((verb) => !conjugation.verbs.includes(verb))
      : []
  const verbs = [...conjugation.verbs, ...auxiliaries].slice(0, maxConjugationVerbs)
  const { focus } = conjugation
  return {
    focus:
      focus?.tense !== null && focus?.tense !== undefined && !chosen.includes(focus.tense)
        ? { ...focus, tense: null }
        : focus,
    tenses: chosen,
    verbs,
  }
}

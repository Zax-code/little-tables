import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Engine } from '@little-tables/engine'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { testEngine } from '../test/engine.js'
import { searchKey, searchVerbs, sections, toggleTense, type VerbIndex } from './verb-catalogue.js'

const index = (
  JSON.parse(readFileSync(join(import.meta.dirname, '../../public/verbs/index.json'), 'utf8')) as {
    verbs: VerbIndex
  }
).verbs

describe('the verb catalogue', () => {
  it('offers the whole Lefff, the verbs parents asked for included', () => {
    expect(index.length).toBeGreaterThan(7_000)
    const verbs = new Set(index.map(([verb]) => verb))
    for (const verb of ['apercevoir', 'sourire', 'essayer', 'servir', 'comprendre', 'apprendre'])
      expect(verbs.has(verb)).toBe(true)
  })

  it('lists in its sections only verbs of the index the engine conjugates', async () => {
    const verbs = new Set(index.map(([verb]) => verb))
    const listed = sections.flatMap((section) => section.verbs)
    expect(listed.filter((verb) => !verbs.has(verb))).toEqual([])
    expect(new Set(listed).size).toBe(listed.length)
    const unknown = await Effect.runPromise(
      Effect.flatMap(Engine, (engine) =>
        Effect.forEach(listed, (verb) =>
          Effect.map(engine.verbTable({ verb }), (table) => (table === null ? [verb] : [])),
        ),
      ).pipe(Effect.provide(testEngine)),
    )
    expect(unknown.flat()).toEqual([])
  })

  it('searches without accents, starting letters first', () => {
    expect(searchKey(' Réfléchir ')).toBe('reflechir')
    expect(searchVerbs(index, 'reflechir')[0]).toBe('réfléchir')
    expect(searchVerbs(index, 'connaitre')).toContain('connaître')
    expect(searchVerbs(index, 'aperc')[0]).toBe('apercevoir')
    expect(searchVerbs(index, '')).toEqual([])
    expect(searchVerbs(index, 'er').length).toBe(20)
  })

  it('ticks the tenses in their order, with the auxiliaries for the compound past', () => {
    const ticked = toggleTense(
      { focus: { tense: 'present', verb: 'finir' }, tenses: ['future'], verbs: ['finir', 'avoir'] },
      'present',
    )
    expect(ticked.tenses).toEqual(['present', 'future'])
    expect(toggleTense(ticked, 'compound-past').verbs).toEqual(['finir', 'avoir', 'être'])
    // The verb put forward stays so, at every tense, once its tense is unticked.
    expect(toggleTense(ticked, 'present')).toEqual({
      focus: { tense: null, verb: 'finir' },
      tenses: ['future'],
      verbs: ['finir', 'avoir'],
    })
  })
})

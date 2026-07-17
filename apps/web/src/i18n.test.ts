import { describe, expect, it } from 'vitest'

import { resolveLocale, translate } from './i18n.js'

describe('internationalization', () => {
  it('defaults to French while preserving an explicit supported locale', () => {
    expect(resolveLocale(null)).toBe('fr')
    expect(resolveLocale('de')).toBe('fr')
    expect(resolveLocale('en')).toBe('en')
  })

  it('writes warm, accented French copy with interpolated values', () => {
    expect(translate('fr', 'home.firstVisitHeading', { name: 'léa' })).toBe('coucou, léa ♡')
    expect(translate('fr', 'home.firstVisitIntro')).toBe(
      'on va trouver par où commencer, tout doucement.',
    )
    expect(translate('fr', 'practice.almost', { answer: 42 })).toBe('presque — c’était 42')
    expect(translate('fr', 'home.mode')).toBe('voir les autres séances')
  })

  it('keeps daily watering and the forgiving week rhythm natural in both languages', () => {
    expect(translate('en', 'watering.dueOne')).toBe('1 flower is ready for water · about 1 min')
    expect(translate('fr', 'watering.dueMany', { count: 6, minutes: 2 })).toBe(
      '6 fleurs à arroser · environ 2 min',
    )
    expect(translate('en', 'week.countMany', { count: 3 })).toBe('3 days in bloom out of 7')
    expect(translate('fr', 'week.explainer')).toBe(
      'Trois jours, quand tu veux dans la semaine. Les jours de pause n’effacent rien.',
    )
  })

  it('explains rescue strategies without turning them into answer-only feedback', () => {
    expect(
      translate('en', 'rescue.bridgeMany', {
        answer: 63,
        extraLeft: 2,
        knownAnswer: 49,
        knownLeft: 7,
        right: 7,
      }),
    ).toBe('Start with 7 × 7 = 49. Add 2 more groups of 7: you get 63.')
    expect(
      translate('fr', 'rescue.bridgeOne', {
        answer: 56,
        knownAnswer: 48,
        knownLeft: 6,
        right: 8,
      }),
    ).toBe('Pars de 6 × 8 = 48. Ajoute encore un groupe de 8 : tu arrives à 56.')
    expect(translate('fr', 'rescue.try')).toBe('à moi d’essayer')
  })

  it('describes learning and table progress without scores or comparison', () => {
    expect(translate('en', 'insight.familiarMany', { count: 2 })).toBe(
      '2 facts are feeling more familiar.',
    )
    expect(translate('fr', 'insight.recalledMany', { count: 3 })).toBe(
      'tu en as retrouvé 3 toute seule.',
    )
    expect(translate('fr', 'tables.summary', { growing: 3, newCount: 4, rooted: 5 })).toBe(
      '5 bien ancrés · 3 en chemin · 4 à découvrir',
    )
  })

  it('names garden chapters, the collection, and ambient visits in each locale', () => {
    expect(translate('en', 'collection.foundCountOne')).toBe('1 plant found')
    expect(translate('fr', 'collection.foundCountMany', { count: 12 })).toBe(
      '12 plantes découvertes',
    )
    expect(translate('fr', 'chapter.secret-greenhouse')).toBe('la serre secrète')
    expect(translate('en', 'ambient.ladybug')).toBe('a ladybug stopped by to say hello.')
    expect(translate('fr', 'ambient.rainbow')).toBe(
      'un petit arc-en-ciel s’est glissé après la pluie.',
    )
    expect(translate('en', 'plant.blue-wisteria')).toBe('blue wisteria')
    expect(translate('fr', 'plant.ivory-magnolia')).toBe('magnolia ivoire')
    expect(translate('fr', 'chapter.progress', { current: 1, flower: 'fleur', total: 3 })).toBe(
      '1 fleur sur 3 dans ce coin',
    )
    expect(translate('en', 'chapter.progress', { current: 3, flower: 'flowers', total: 3 })).toBe(
      '3 flowers out of 3 in this chapter',
    )
  })

  it('introduces tables 11 and 12 and inverse division as optional paths', () => {
    expect(translate('en', 'curriculum.elevenPattern')).toBe(
      'From 1 to 9, the digit repeats: 4 × 11 = 44.',
    )
    expect(translate('fr', 'curriculum.twelvePattern')).toBe(
      'Avec 12, pense 10 et encore 2 : 7 × 12, c’est 7 × 10 plus 7 × 2.',
    )
    expect(
      translate('fr', 'curriculum.divisionFamily', {
        answer: 56,
        left: 7,
        right: 8,
      }),
    ).toBe('Quand tu connais 7 × 8 = 56, tu connais aussi 56 ÷ 7 = 8.')
    expect(translate('fr', 'curriculum.divisionProgress', { rooted: 3, total: 8 })).toBe(
      '3 calculs sur 8 sont bien ancrés sur le chemin à l’envers',
    )
    expect(translate('fr', 'garden.extraCopy')).toBe(
      'La fleur du jour est déjà au chaud. Cette petite séance, c’est juste pour toi.',
    )
  })
})

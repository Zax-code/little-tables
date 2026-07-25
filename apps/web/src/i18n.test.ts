import { describe, expect, it } from 'vitest'

import { catalogForLocale, resolveLocale, supportedLocales, translate } from './i18n.js'

describe('internationalization', () => {
  it('keeps every locale complete, nonblank, and interpolation-compatible', () => {
    const englishCatalog = catalogForLocale('en')
    const englishKeys = Object.keys(englishCatalog).sort()
    const placeholders = (copy: string) =>
      Array.from(copy.matchAll(/\{([^}]+)\}/g), (match) => match[1]).sort()
    const englishPlaceholders = new Map(
      Object.entries(englishCatalog).map(([key, copy]) => [key, placeholders(copy)]),
    )

    for (const locale of supportedLocales) {
      const catalog = catalogForLocale(locale)
      expect(Object.keys(catalog).sort()).toEqual(englishKeys)
      for (const [key, copy] of Object.entries(catalog)) {
        expect(copy.trim(), `${locale}:${key}`).not.toBe('')
        expect(placeholders(copy), `${locale}:${key}`).toEqual(englishPlaceholders.get(key))
      }
    }
  })

  it('defaults to French while preserving an explicit supported locale', () => {
    expect(resolveLocale(null)).toBe('fr')
    expect(resolveLocale('de')).toBe('fr')
    expect(resolveLocale('en')).toBe('en')
    expect(resolveLocale('zh-Hans')).toBe('zh-Hans')
  })

  it('writes warm, accented French copy with interpolated values', () => {
    expect(translate('fr', 'home.firstVisitHeading', { name: 'léa' })).toBe('coucou, léa ♡')
    expect(translate('fr', 'home.firstVisitIntro')).toBe(
      'on va trouver par où commencer, tout doucement.',
    )
    expect(translate('fr', 'practice.almost', { answer: 42 })).toBe('presque — c’était 42')
    expect(translate('fr', 'home.mode')).toBe('voir les autres séances')
  })

  it('writes warm, concise Simplified Chinese copy with natural arithmetic language', () => {
    expect(translate('zh-Hans', 'home.firstVisitHeading', { name: '小雨' })).toBe('你好呀，小雨 ♡')
    expect(translate('zh-Hans', 'practice.almost', { answer: 42 })).toBe('差一点点，答案是 42')
    expect(translate('zh-Hans', 'practice.times', { left: 6, right: 7 })).toBe('6 乘 7')
    expect(translate('zh-Hans', 'week.explainer')).toBe(
      '一周练习 3 天就很好。休息几天，花园也不会倒退。',
    )
  })

  it('uses natural Simplified Chinese for the daily garden rhythm and mastery gate', () => {
    expect(translate('zh-Hans', 'common.bloom')).toBe('次浇水')
    expect(translate('zh-Hans', 'celebration.gardenBloom')).toBe('+1 次浇水')
    expect(translate('zh-Hans', 'garden.howDaily')).toBe('完成今天的小练习，就能给植物浇一次水。')
    expect(translate('zh-Hans', 'garden.howTiming')).toBe(
      '花园每天只前进一步，第二天才能再浇水。当天多练会让乘法更熟练，但不会多一次浇水。',
    )
    expect(translate('zh-Hans', 'garden.masteryBlocked', { remaining: 4 })).toBe(
      '已经浇满 3 次水啦。再不看提示，自己答对 4 道乘法题，它就会开花。浇水进度会好好保留。',
    )
    expect(translate('zh-Hans', 'watering.dueMany', { count: 6, minutes: 2 })).toBe(
      '6 道小题 · 大约 2 分钟',
    )
  })

  it('uses warm, family-friendly Simplified Chinese for profile management', () => {
    expect(translate('zh-Hans', 'family.heading')).toBe('一个账号，全家都有自己的花园')
    expect(translate('zh-Hans', 'family.intro')).toBe(
      '每位家人都有自己的练习记录、成长、奖励、数据和花园；换一台设备也能接着来。',
    )
    expect(translate('zh-Hans', 'family.added', { name: '小雨' })).toBe('小雨也有自己的花园啦。')
    expect(translate('zh-Hans', 'family.switcherAria', { name: '小雨' })).toBe(
      '当前是小雨。切换家人',
    )
    expect(translate('zh-Hans', 'family.removeDialogWarning', { name: '小雨' })).toBe(
      '小雨的档案会从家庭成员中永久移除，之后无法恢复。',
    )
    expect(translate('zh-Hans', 'app.openingFamily')).toBe('正在打开全家的花园…')
    expect(translate('zh-Hans', 'family.learnerFallback')).toBe('小园丁')
  })

  it('keeps daily watering and the forgiving week rhythm natural in both languages', () => {
    expect(translate('en', 'watering.dueOne')).toBe('1 quick question · about 1 min')
    expect(translate('fr', 'watering.dueMany', { count: 6, minutes: 2 })).toBe(
      '6 petites questions · environ 2 min',
    )
    expect(translate('en', 'week.countMany', { count: 3 })).toBe('3 days in bloom out of 7')
    expect(translate('fr', 'week.explainer')).toBe(
      'Trois jours, quand tu veux dans la semaine. Les jours de pause n’effacent rien.',
    )
  })

  it('describes garden progress as one watering step per completed daily session', () => {
    expect(translate('en', 'garden.howDaily')).toBe(
      'Complete today’s little session to earn one watering for your plant.',
    )
    expect(translate('en', 'garden.howTiming')).toBe(
      'The garden advances only once a day: the next watering awaits you the following day. Extra practice makes your math skills stronger, but does not earn another watering that day.',
    )
    expect(translate('en', 'garden.howCollection')).toBe(
      'The current flower blooms after three waterings.',
    )
    expect(translate('fr', 'garden.howDaily')).toBe(
      'Termine la petite séance du jour pour obtenir un arrosage pour ta plante.',
    )
    expect(translate('fr', 'garden.howTiming')).toBe(
      'Le jardin avance une seule fois par jour : le prochain arrosage t’attend le lendemain. Une séance en plus rend tes calculs plus solides, mais ne donne pas un autre arrosage ce jour-là.',
    )
    expect(translate('fr', 'garden.howCollection')).toBe(
      'La fleur en cours s’épanouit au bout de trois arrosages.',
    )
  })

  it('uses watering—not flowers—as the unit of garden progression', () => {
    expect(translate('en', 'common.bloom')).toBe('watering')
    expect(translate('fr', 'common.blooms')).toBe('arrosages')
    expect(translate('en', 'celebration.gardenBloom')).toBe('+1 watering')
    expect(translate('fr', 'garden.goalProgress', { current: 2, total: 3 })).toBe(
      'Arrosages : 2 sur 3',
    )
    expect(translate('en', 'garden.masteryBlocked', { remaining: 4 })).toContain(
      '3 waterings are complete',
    )
    expect(translate('fr', 'garden.masteryBlocked', { remaining: 4 })).not.toContain('3 fleurs')
    expect(translate('en', 'watering.rewardReady')).toBe('today’s watering is waiting')
    expect(translate('fr', 'watering.dueMany', { count: 5, minutes: 1 })).toBe(
      '5 petites questions · environ 1 min',
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
    expect(translate('fr', 'chapter.progress', { current: 1, flower: 'plante', total: 3 })).toBe(
      '1 plante sur 3 dans ce coin',
    )
    expect(translate('en', 'chapter.progress', { current: 3, flower: 'plants', total: 3 })).toBe(
      '3 plants out of 3 in this chapter',
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
      'L’arrosage d’aujourd’hui est bien gardé dans le jardin, et le prochain t’attend demain. Cette petite séance n’ajoute pas d’arrosage aujourd’hui, mais rend tes calculs plus solides.',
    )
  })

  it('keeps the completed home card positive and explicit about tomorrow', () => {
    expect(translate('en', 'watering.done')).toContain('safe in your garden')
    expect(translate('en', 'watering.doneCopy')).toContain('The next watering is ready tomorrow')
    expect(translate('en', 'watering.rewardEarned')).toContain('still strengthens your math skills')
    expect(translate('fr', 'watering.extra')).toContain('pas d’arrosage en plus aujourd’hui')
  })

  it('uses inclusive family-member language in family profile controls', () => {
    expect(translate('en', 'family.addHeading')).toBe('add a family member')
    expect(translate('en', 'family.intro')).toContain('Each family member')
    expect(translate('en', 'family.switcherMenu')).toBe('Choose a family member')
    expect(translate('fr', 'family.addHeading')).toBe('ajouter un membre de la famille')
    expect(translate('fr', 'family.intro')).toContain('Chaque membre de la famille')
    expect(translate('fr', 'family.switcherMenu')).toBe('Choisir un membre de la famille')
  })

  it('shows only character first names for selectable family avatars', () => {
    const avatarNames = [
      ['sprout', 'Miffy', '米菲'],
      ['malo-bear', 'Malo', '马洛'],
      ['fenna-fox', 'Fenna', '芬娜'],
      ['mina-cat', 'Mina', '米娜'],
      ['paco-dog', 'Paco', '帕科'],
      ['colin-mallard', 'Colin', '科林'],
    ] as const

    for (const [avatarId, name, chineseName] of avatarNames) {
      expect(translate('en', `family.avatar.${avatarId}`)).toBe(name)
      expect(translate('fr', `family.avatar.${avatarId}`)).toBe(name)
      expect(translate('zh-Hans', `family.avatar.${avatarId}`)).toBe(chineseName)
    }
  })
})

import { describe, expect, it } from 'vitest'

import { Characters } from './character.js'

describe('Characters', () => {
  it('resolves every durable avatar ID to its canonical character', () => {
    expect(
      Object.fromEntries(
        Characters.avatarIds.map((avatarId) => [avatarId, Characters.resolveAvatarId(avatarId)]),
      ),
    ).toEqual({
      berry: 'miffy',
      bluebell: 'miffy',
      'colin-mallard': 'colin-mallard',
      'fenna-fox': 'fenna-fox',
      'malo-bear': 'malo-bear',
      'mina-cat': 'mina-cat',
      'paco-dog': 'paco-dog',
      sprout: 'miffy',
      sunbeam: 'miffy',
    })
  })
})

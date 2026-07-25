import { Characters } from '@little-tables/domain'
import { describe, expect, it } from 'vitest'

import { characterCatalog, characterSceneIds, resolveCharacter } from './character-catalog.js'

describe('character catalog', () => {
  it('provides every production scene for every canonical character', () => {
    expect(Object.keys(characterCatalog)).toEqual(Characters.characterIds)
    for (const characterId of Characters.characterIds) {
      const character = characterCatalog[characterId]
      expect(character.id).toBe(characterId)
      expect(Object.keys(character.scenes)).toEqual(characterSceneIds)
      for (const sceneId of characterSceneIds) {
        expect(character.scenes[sceneId].src).toBe(
          `/characters/${characterId}/${character.scenes[sceneId].fileName}`,
        )
      }
    }
  })

  it('uses Miffy as the compatibility character for retired avatar IDs', () => {
    expect(resolveCharacter('berry')).toBe(characterCatalog.miffy)
    expect(resolveCharacter('bluebell')).toBe(characterCatalog.miffy)
    expect(resolveCharacter('sunbeam')).toBe(characterCatalog.miffy)
  })
})

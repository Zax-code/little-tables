/// <reference types="node" />

import { Characters } from '@little-tables/domain'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  characterCatalog,
  characterSceneIds,
  characterSourcesForPath,
  resolveCharacter,
} from './character-catalog.js'

function webpDimensions(source: Uint8Array): readonly [number, number] {
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength)
  const text = (offset: number, length: number) =>
    new TextDecoder().decode(source.subarray(offset, offset + length))
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WEBP') {
    throw new Error('Not a WebP file')
  }

  let offset = 12
  while (offset + 8 <= source.byteLength) {
    const chunk = text(offset, 4)
    const chunkLength = view.getUint32(offset + 4, true)
    const dataOffset = offset + 8
    if (chunk === 'VP8X') {
      return [
        view.getUint8(dataOffset + 4) +
          (view.getUint8(dataOffset + 5) << 8) +
          (view.getUint8(dataOffset + 6) << 16) +
          1,
        view.getUint8(dataOffset + 7) +
          (view.getUint8(dataOffset + 8) << 8) +
          (view.getUint8(dataOffset + 9) << 16) +
          1,
      ]
    }
    if (chunk === 'VP8L') {
      const packed = view.getUint32(dataOffset + 1, true)
      return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1]
    }
    if (chunk === 'VP8 ') {
      return [
        view.getUint16(dataOffset + 6, true) & 0x3fff,
        view.getUint16(dataOffset + 8, true) & 0x3fff,
      ]
    }
    offset = dataOffset + chunkLength + (chunkLength % 2)
  }
  throw new Error('WebP dimensions are missing')
}

describe('character catalog', () => {
  it('provides every production scene for every canonical character', () => {
    expect(Object.keys(characterCatalog)).toEqual(Characters.characterIds)
    for (const characterId of Characters.characterIds) {
      const character = characterCatalog[characterId]
      expect(character.id).toBe(characterId)
      expect(Object.keys(character.scenes)).toEqual(characterSceneIds)
      for (const sceneId of characterSceneIds) {
        expect(character.scenes[sceneId].height).toBeGreaterThan(0)
        expect(character.scenes[sceneId].opticalBounds).toHaveLength(4)
        expect(character.scenes[sceneId].src).toBe(
          `/characters/${characterId}/${character.scenes[sceneId].fileName}`,
        )
      }
    }
  })

  it('points to production files with the declared dimensions', () => {
    for (const character of Object.values(characterCatalog)) {
      for (const asset of Object.values(character.scenes)) {
        const source = readFileSync(new URL(`../public${asset.src}`, import.meta.url))
        expect(webpDimensions(source), asset.src).toEqual([asset.width, asset.height])
      }
    }
  })

  it('uses Miffy as the compatibility character for retired avatar IDs', () => {
    expect(resolveCharacter('berry')).toBe(characterCatalog.miffy)
    expect(resolveCharacter('bluebell')).toBe(characterCatalog.miffy)
    expect(resolveCharacter('sunbeam')).toBe(characterCatalog.miffy)
  })

  it('returns only the selected character scenes needed by the current route', () => {
    const fenna = characterCatalog['fenna-fox']

    expect(characterSourcesForPath(fenna, '/practice')).toEqual([
      '/characters/fenna-fox/practice-idle.webp',
      '/characters/fenna-fox/practice-correct.webp',
      '/characters/fenna-fox/practice-encourage.webp',
    ])
    expect(characterSourcesForPath(fenna, '/garden/collection')).toEqual([
      '/characters/fenna-fox/garden-walk-sheet.webp',
      '/characters/fenna-fox/garden-water-sheet.webp',
    ])
    expect(characterSourcesForPath(fenna, '/')).toEqual([
      '/characters/fenna-fox/home.webp',
      '/characters/fenna-fox/connect-profile.webp',
    ])
  })
})

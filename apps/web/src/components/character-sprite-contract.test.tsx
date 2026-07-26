import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('motion/react', () => ({
  useReducedMotion: () => true,
}))

import { characterCatalog } from '../character-catalog.js'
import { I18nProvider } from '../i18n.js'
import { SelectedCharacterContext } from '../selected-character-context.js'
import { CelebrationSprite } from './celebration-sprite.js'
import { GardenWalkingSprite } from './garden-walking-sprite.js'
import { GardenWateringSprite } from './garden-watering-sprite.js'

describe('character sprite runtime contract', () => {
  it('keeps reduced-motion frames meaningful and garden mirroring declarative', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <SelectedCharacterContext value={characterCatalog['colin-mallard']}>
          <CelebrationSprite />
          <GardenWalkingSprite facing="left" />
          <GardenWalkingSprite facing="right" />
          <GardenWateringSprite facing="left" reduceMotion />
        </SelectedCharacterContext>
      </I18nProvider>,
    )

    expect(markup).toContain('celebration-sprite celebration-sprite--static')
    expect(markup).toContain('garden-walking-sprite--facing-left')
    expect(markup).toContain('garden-walking-sprite--facing-right')
    expect(markup).toContain('garden-watering-sprite--facing-left garden-watering-sprite--static')
    expect(markup).toContain('/characters/colin-mallard/celebration-sheet.webp')
    expect(markup).toContain('/characters/colin-mallard/garden-walk-sheet.webp')
    expect(markup).toContain('/characters/colin-mallard/garden-water-sheet.webp')
  })
})

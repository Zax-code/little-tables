import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('motion/react', () => ({
  m: {
    img: (props: Readonly<Record<string, unknown>>) => {
      const { animate, initial, transition, ...imageProps } = props
      void animate
      void initial
      void transition
      return <img {...imageProps} />
    },
  },
  useReducedMotion: () => false,
}))

import { characterCatalog } from '../character-catalog.js'
import { I18nProvider } from '../i18n.js'
import { SelectedCharacterContext } from '../selected-character-context.js'
import { CelebrationSprite } from './celebration-sprite.js'
import { CharacterIllustration } from './character-illustration.js'
import { GardenWalkingSprite } from './garden-walking-sprite.js'
import { GardenWateringSprite } from './garden-watering-sprite.js'
import { PracticeCharacter } from './practice-character.js'

function SelectedPaco({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <I18nProvider initialLocale="en">
      <SelectedCharacterContext value={characterCatalog['paco-dog']}>
        {children}
      </SelectedCharacterContext>
    </I18nProvider>
  )
}

describe('authenticated character visuals', () => {
  it('resolves every active surface from the selected profile character', () => {
    const markup = renderToStaticMarkup(
      <SelectedPaco>
        <CharacterIllustration scene="home" />
        <PracticeCharacter reaction="idle" />
        <PracticeCharacter reaction="correct" />
        <PracticeCharacter reaction="encourage" />
        <CelebrationSprite />
        <GardenWalkingSprite facing="right" />
        <GardenWateringSprite facing="left" reduceMotion={false} />
      </SelectedPaco>,
    )

    expect(markup).toContain('/characters/paco-dog/home.webp')
    expect(markup).toContain('/characters/paco-dog/practice-idle.webp')
    expect(markup).toContain('/characters/paco-dog/practice-correct.webp')
    expect(markup).toContain('/characters/paco-dog/practice-encourage.webp')
    expect(markup).toContain('/characters/paco-dog/celebration-sheet.webp')
    expect(markup).toContain('/characters/paco-dog/garden-walk-sheet.webp')
    expect(markup).toContain('/characters/paco-dog/garden-water-sheet.webp')
    expect(markup).toContain('Paco holding a red tulip')
    expect(markup).toContain('Paco walking through the garden')
    expect(markup).not.toContain('/generated/miffy-')
  })
})

// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('motion/react', () => ({
  m: {
    img: (props: Readonly<Record<string, unknown>>) => createElement('img', props),
  },
  useReducedMotion: () => false,
}))

import { characterCatalog } from '../character-catalog.js'
import { I18nProvider } from '../i18n.js'
import { SelectedCharacterContext } from '../selected-character-context.js'
import { CelebrationSprite } from './celebration-sprite.js'
import { CharacterIllustration } from './character-illustration.js'

describe('character asset fallback', () => {
  let container: HTMLDivElement
  let root: Root

  function renderSelected(characterId: 'fenna-fox' | 'mina-cat', visual: 'celebration' | 'home') {
    act(() => {
      root.render(
        <I18nProvider initialLocale="en">
          <SelectedCharacterContext value={characterCatalog[characterId]}>
            {visual === 'home' ? <CharacterIllustration scene="home" /> : <CelebrationSprite />}
          </SelectedCharacterContext>
        </I18nProvider>,
      )
    })
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('offers a neutral retry before explicitly falling back to Miffy', () => {
    renderSelected('fenna-fox', 'home')
    const selected = container.querySelector('img')
    expect(selected?.getAttribute('src')).toBe('/characters/fenna-fox/home.webp')

    act(() => {
      selected?.dispatchEvent(new Event('error', { bubbles: true }))
    })

    const retry = container.querySelector<HTMLButtonElement>('.character-asset-retry')
    expect(retry?.textContent).toBe('retry character artwork')
    expect(container.querySelector('img')).toBeNull()

    act(() => retry?.click())
    const retrying = container.querySelector('img')
    expect(retrying?.getAttribute('src')).toBe('/characters/fenna-fox/home.webp')

    act(() => {
      retrying?.dispatchEvent(new Event('error', { bubbles: true }))
    })

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/characters/miffy/home.webp')

    renderSelected('mina-cat', 'home')
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/characters/mina-cat/home.webp',
    )
  })

  it('detects decode failure for CSS sprite sheets through the asset probe', () => {
    renderSelected('fenna-fox', 'celebration')
    const selected = container.querySelector<HTMLImageElement>('.character-asset-probe')
    expect(selected?.getAttribute('src')).toBe('/characters/fenna-fox/celebration-sheet.webp')

    act(() => {
      selected?.dispatchEvent(new Event('error', { bubbles: true }))
    })
    const retry = container.querySelector<HTMLButtonElement>('.character-asset-retry')
    expect(retry).not.toBeNull()

    act(() => retry?.click())
    const retrying = container.querySelector<HTMLImageElement>('.character-asset-probe')
    act(() => {
      retrying?.dispatchEvent(new Event('error', { bubbles: true }))
    })

    expect(
      container.querySelector<HTMLImageElement>('.character-asset-probe')?.getAttribute('src'),
    ).toBe('/characters/miffy/celebration-sheet.webp')
    expect(
      container.querySelector<HTMLElement>('.celebration-sprite__sheet')?.style.backgroundImage,
    ).toContain('/characters/miffy/celebration-sheet.webp')
  })
})

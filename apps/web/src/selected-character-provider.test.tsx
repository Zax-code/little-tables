// @vitest-environment happy-dom

import type { ChildProfile } from '@little-tables/domain'
import { act, useMemo, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FamilyProfileContext } from './family-profile-context.js'
import { I18nProvider } from './i18n.js'
import { SelectedCharacterProvider } from './selected-character-provider.js'
import { useFamilyProfile } from './use-family-profile.js'
import { useSelectedCharacter } from './use-selected-character.js'

const profiles = [
  { avatarId: 'sprout', id: 'one', name: 'Camille' },
  { avatarId: 'fenna-fox', id: 'two', name: 'Zak' },
] as const satisfies ReadonlyArray<ChildProfile>

describe('SelectedCharacterProvider', () => {
  let container: HTMLDivElement
  let root: Root

  function CharacterProbe() {
    const character = useSelectedCharacter()
    return (
      <output
        data-character={character.id}
        data-home={character.scene('home').src}
        data-name={character.displayName}
      />
    )
  }

  function SwitchProbe() {
    const { switchProfile } = useFamilyProfile()
    return <button onClick={() => switchProfile('two')}>switch</button>
  }

  function Harness() {
    const [activeProfile, setActiveProfile] = useState<ChildProfile>(profiles[0])
    const value = useMemo(
      () => ({
        activeProfile,
        profiles,
        switchProfile: (profileId: string) => {
          const selected = profiles.find(({ id }) => id === profileId)
          if (selected !== undefined) setActiveProfile(selected)
        },
      }),
      [activeProfile],
    )
    return (
      <I18nProvider initialLocale="en">
        <FamilyProfileContext value={value}>
          <SelectedCharacterProvider>
            <CharacterProbe />
            <SwitchProbe />
          </SelectedCharacterProvider>
        </FamilyProfileContext>
      </I18nProvider>
    )
  }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root.render(<Harness />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('changes scenes atomically with the active family profile', () => {
    const output = container.querySelector('output')
    expect(output?.dataset).toMatchObject({
      character: 'miffy',
      home: '/characters/miffy/home.webp',
      name: 'Miffy',
    })

    act(() => {
      container.querySelector('button')?.click()
    })
    expect(output?.dataset).toMatchObject({
      character: 'fenna-fox',
      home: '/characters/fenna-fox/home.webp',
      name: 'Fenna',
    })
  })
})

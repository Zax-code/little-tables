import { createContext } from 'react'

import type { CharacterCatalogEntry } from './character-catalog.js'

export const SelectedCharacterContext = createContext<CharacterCatalogEntry | null>(null)

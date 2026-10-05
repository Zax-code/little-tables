/** Applies the parent space's display preferences to the whole document. */
import { useEffect } from 'react'

import type { Preferences } from '../data/schema.js'

/** Applies appearance and text size to the document, as chosen in the parent space. */
export function usePreferenceEffects(preferences: Preferences) {
  useEffect(() => {
    const root = document.documentElement
    root.lang = preferences.language
    if (preferences.appearance === 'system') delete root.dataset.theme
    else root.dataset.theme = preferences.appearance
    root.style.setProperty(
      '--lt-text-scale',
      preferences.textSize === 'larger' ? '1.25' : preferences.textSize === 'large' ? '1.12' : '1',
    )
  }, [preferences])
}

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
    // The status bar takes the colour of the chosen appearance, not only the phone's.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      const scheme = meta.dataset.scheme ?? 'light'
      meta.media =
        preferences.appearance === 'system'
          ? `(prefers-color-scheme: ${scheme})`
          : preferences.appearance === scheme
            ? 'all'
            : 'not all'
    }
    root.style.setProperty(
      '--lt-text-scale',
      preferences.textSize === 'larger' ? '1.25' : preferences.textSize === 'large' ? '1.12' : '1',
    )
  }, [preferences])
}

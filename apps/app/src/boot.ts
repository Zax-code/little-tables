/**
 * Runs before the app: links the manifest in the language chosen on this device (French by
 * default). A module rather than an inline script, which the site's CSP refuses.
 */
let language = 'fr'
try {
  const stored = JSON.parse(window.localStorage.getItem('little-tables:preferences') ?? 'null') as {
    language?: unknown
  } | null
  const chosen = stored?.language ?? window.localStorage.getItem('little-tables:locale')
  if (chosen === 'en' || chosen === 'zh-Hans') language = chosen
} catch {
  // French stays when storage is restricted.
}
const manifest = document.createElement('link')
manifest.rel = 'manifest'
manifest.href = `/manifest-${language}.webmanifest`
document.head.append(manifest)
document.documentElement.lang = language

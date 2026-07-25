// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'

import { manifestHref, syncManifestLocale } from './manifest-locale.js'

describe('localized app manifest', () => {
  afterEach(() => {
    document.head.querySelector('link[data-app-manifest]')?.remove()
  })

  it('maps every app locale to its matching install manifest', () => {
    expect(manifestHref('en')).toBe('/manifest-en.webmanifest')
    expect(manifestHref('fr')).toBe('/manifest-fr.webmanifest')
    expect(manifestHref('zh-Hans')).toBe('/manifest-zh-Hans.webmanifest')
  })

  it('updates install metadata when Simplified Chinese is selected', () => {
    const manifest = document.createElement('link')
    manifest.dataset.appManifest = ''
    manifest.rel = 'manifest'
    manifest.href = manifestHref('fr')
    document.head.append(manifest)

    syncManifestLocale('zh-Hans')

    expect(manifest.getAttribute('href')).toBe('/manifest-zh-Hans.webmanifest')
  })
})

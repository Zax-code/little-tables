import type { Locale } from './i18n-catalog.js'

const manifestHrefs = {
  en: '/manifest-en.webmanifest',
  fr: '/manifest-fr.webmanifest',
  'zh-Hans': '/manifest-zh-Hans.webmanifest',
} as const satisfies Readonly<Record<Locale, string>>

export const manifestHref = (locale: Locale): string => manifestHrefs[locale]

export const syncManifestLocale = (locale: Locale): void => {
  const manifest = document.querySelector('link[data-app-manifest]')
  if (manifest instanceof HTMLLinkElement) manifest.setAttribute('href', manifestHref(locale))
}

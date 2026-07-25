import type { Locale } from './i18n-catalog.js'

export const serviceWorkerLocaleMessage = (locale: Locale) =>
  ({ locale, type: 'SET_LOCALE' }) as const

export async function syncServiceWorkerLocale(
  locale: Locale,
  serviceWorker: Pick<ServiceWorkerContainer, 'ready'> = navigator.serviceWorker,
): Promise<void> {
  try {
    const registration = await serviceWorker.ready
    registration.active?.postMessage(serviceWorkerLocaleMessage(locale))
  } catch {
    // A missing or restricted worker must not prevent an in-app language change.
  }
}

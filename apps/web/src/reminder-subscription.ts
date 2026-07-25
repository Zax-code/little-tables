import { type Locale } from './i18n.js'
import { serializePushSubscription, supportsPushNotifications } from './push-subscription.js'

export const saveReminderSubscription = (
  subscription: PushSubscription,
  locale: Locale,
  profileId?: string,
): Promise<Response> =>
  fetch('/api/v1/notifications/subscriptions', {
    body: JSON.stringify({
      locale,
      subscription: serializePushSubscription(subscription),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    headers: {
      'content-type': 'application/json',
      ...(profileId === undefined ? {} : { 'x-little-tables-profile-id': profileId }),
    },
    method: 'POST',
  })

export async function syncExistingReminderLocale(
  locale: Locale,
  profileId?: string,
): Promise<void> {
  if (!supportsPushNotifications()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription === null) return
  await saveReminderSubscription(subscription, locale, profileId)
}

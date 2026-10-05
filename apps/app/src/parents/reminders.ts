/**
 * Daily reminders on this device (`docs/rewrite/TECHNICAL_SPEC.md` §5.5). A browser has one push
 * subscription, which the server attaches to one child: turning reminders on for another child
 * moves it.
 */
import { ApiClient, type ReminderLocale } from '@little-tables/api-contract'
import { deviceTimeZone } from '@little-tables/engine'
import { Data, Effect } from 'effect'

const reminderKey = 'little-tables:reminder-profile'

export class ReminderUnavailable extends Data.TaggedError('ReminderUnavailable')<{
  readonly reason: 'blocked' | 'unsupported'
}> {}

export const remindersSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

/** The child this device reminds, if any. */
export const remindedProfile = (): string | null => {
  try {
    return window.localStorage.getItem(reminderKey)
  } catch {
    return null
  }
}

const remember = (profileId: string | null) => {
  try {
    if (profileId === null) window.localStorage.removeItem(reminderKey)
    else window.localStorage.setItem(reminderKey, profileId)
  } catch {
    // The server keeps the subscription; only the switch's state is lost.
  }
}

const base64UrlToBytes = (value: string) => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const bytesToBase64Url = (buffer: ArrayBuffer | null) =>
  buffer === null
    ? ''
    : btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

const registration = () =>
  Effect.tryPromise({
    catch: () => new ReminderUnavailable({ reason: 'unsupported' }),
    try: () => navigator.serviceWorker.ready,
  })

/** Asks the permission if needed and subscribes this device for `profileId`. */
export const enableReminders = (profileId: string, locale: ReminderLocale) =>
  Effect.gen(function* () {
    if (!remindersSupported()) return yield* new ReminderUnavailable({ reason: 'unsupported' })
    const permission = yield* Effect.promise(() => Notification.requestPermission())
    if (permission !== 'granted') return yield* new ReminderUnavailable({ reason: 'blocked' })
    const api = yield* ApiClient
    const { publicKey } = yield* api.notificationConfig()
    const worker = yield* registration()
    const subscription = yield* Effect.tryPromise({
      catch: () => new ReminderUnavailable({ reason: 'unsupported' }),
      try: async () =>
        (await worker.pushManager.getSubscription()) ??
        (await worker.pushManager.subscribe({
          applicationServerKey: base64UrlToBytes(publicKey),
          userVisibleOnly: true,
        })),
    })
    yield* api.subscribe(profileId, {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime,
      keys: {
        auth: bytesToBase64Url(subscription.getKey('auth')),
        p256dh: bytesToBase64Url(subscription.getKey('p256dh')),
      },
      locale,
      timezone: deviceTimeZone(),
    })
    remember(profileId)
  })

/** Stops reminding `profileId` on this device. */
export const disableReminders = (profileId: string) =>
  Effect.gen(function* () {
    if (!remindersSupported()) return
    const worker = yield* registration()
    const subscription = yield* Effect.promise(() => worker.pushManager.getSubscription())
    if (subscription !== null) {
      const api = yield* ApiClient
      yield* api.unsubscribe(profileId, subscription.endpoint)
      yield* Effect.promise(() => subscription.unsubscribe())
    }
    remember(null)
  })

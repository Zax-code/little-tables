const applicationServerKey = (value: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  return new Uint8Array(bytes.buffer)
}

export const supportsPushNotifications = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const serializePushSubscription = (
  subscription: Pick<PushSubscription, 'endpoint' | 'expirationTime' | 'toJSON'>,
) => ({
  ...subscription.toJSON(),
  endpoint: subscription.endpoint,
  expirationTime: subscription.expirationTime,
})

export async function createPushSubscription(
  registration: ServiceWorkerRegistration,
  publicKey: string,
) {
  return registration.pushManager.subscribe({
    applicationServerKey: applicationServerKey(publicKey),
    userVisibleOnly: true,
  })
}

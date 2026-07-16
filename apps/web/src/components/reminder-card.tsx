import { useEffect, useState } from 'react'

import {
  createPushSubscription,
  serializePushSubscription,
  supportsPushNotifications,
} from '../push-subscription.js'

type ReminderState = 'checking' | 'disabled' | 'enabled' | 'unsupported' | 'working'

export function ReminderCard() {
  const [state, setState] = useState<ReminderState>(() =>
    supportsPushNotifications() ? 'checking' : 'unsupported',
  )
  const [message, setMessage] = useState('a gentle nudge at 6:00 pm')

  useEffect(() => {
    if (!supportsPushNotifications()) return
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription === null ? 'disabled' : 'enabled'))
      .catch(() => setState('disabled'))
  }, [])

  if (state === 'unsupported') return null

  const enable = async () => {
    setState('working')
    setMessage('asking this device…')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('disabled')
        setMessage('notifications are blocked on this device')
        return
      }
      const [registration, configResponse] = await Promise.all([
        navigator.serviceWorker.ready,
        fetch('/api/v1/notifications/config'),
      ])
      if (!configResponse.ok) throw new Error('Reminder service unavailable')
      const config = (await configResponse.json()) as { publicKey: string }
      const subscription = await createPushSubscription(registration, config.publicKey)
      const response = await fetch('/api/v1/notifications/subscriptions', {
        body: JSON.stringify({
          subscription: serializePushSubscription(subscription),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      if (!response.ok) {
        await subscription.unsubscribe()
        throw new Error(
          response.status === 401 ? 'Sign in with Google first' : 'Could not save reminder',
        )
      }
      setState('enabled')
      setMessage('daily at 6:00 pm · quiet after you practice')
    } catch (error) {
      setState('disabled')
      setMessage(error instanceof Error ? error.message : 'could not enable reminders')
    }
  }

  if (state === 'enabled') return null

  return (
    <aside className="reminder-card">
      <span aria-hidden="true" className="reminder-bell">
        ♡
      </span>
      <div>
        <strong>remember your tiny win</strong>
        <p>{message}</p>
      </div>
      <button
        disabled={state === 'checking' || state === 'working'}
        onClick={() => void enable()}
        type="button"
      >
        {state === 'working' ? 'wait…' : 'turn on'}
      </button>
    </aside>
  )
}

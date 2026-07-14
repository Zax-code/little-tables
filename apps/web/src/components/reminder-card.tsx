import { useEffect, useState } from 'react'

type ReminderState = 'checking' | 'disabled' | 'enabled' | 'unsupported' | 'working'

const applicationServerKey = (value: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  return new Uint8Array(bytes.buffer)
}

const supported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function ReminderCard() {
  const [state, setState] = useState<ReminderState>(() =>
    supported() ? 'checking' : 'unsupported',
  )
  const [message, setMessage] = useState('a gentle nudge at 6:00 pm')

  useEffect(() => {
    if (!supported()) return
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
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: applicationServerKey(config.publicKey),
        userVisibleOnly: true,
      })
      const response = await fetch('/api/v1/notifications/subscriptions', {
        body: JSON.stringify({
          subscription: subscription.toJSON(),
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

  const disable = async () => {
    setState('working')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription !== null) {
        await fetch('/api/v1/notifications/subscriptions', {
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          headers: { 'content-type': 'application/json' },
          method: 'DELETE',
        })
        await subscription.unsubscribe()
      }
      setState('disabled')
      setMessage('a gentle nudge at 6:00 pm')
    } catch {
      setState('enabled')
      setMessage('could not turn the reminder off')
    }
  }

  if (state === 'enabled') {
    return (
      <button
        aria-label="Turn daily reminder off"
        className="reminder-status"
        onClick={() => void disable()}
      >
        <span aria-hidden="true">♡</span> reminder on
      </button>
    )
  }

  return (
    <aside className="reminder-card">
      <span aria-hidden="true" className="reminder-bell">
        ♡
      </span>
      <div>
        <strong>remember your tiny win</strong>
        <p>{message}</p>
      </div>
      <button disabled={state === 'checking' || state === 'working'} onClick={() => void enable()}>
        {state === 'working' ? 'wait…' : 'turn on'}
      </button>
    </aside>
  )
}

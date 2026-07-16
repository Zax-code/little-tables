import { useEffect, useState } from 'react'
import { Data } from 'effect'

import { createPushSubscription, supportsPushNotifications } from '../push-subscription.js'
import { saveReminderSubscription } from '../reminder-subscription.js'
import { useI18n, type TranslationKey } from '../i18n.js'

type ReminderState = 'checking' | 'disabled' | 'enabled' | 'unsupported' | 'working'
type ReminderErrorReason = 'save_failed' | 'service_unavailable' | 'sign_in_first'

class ReminderEnableError extends Data.TaggedError('ReminderEnableError')<{
  reason: ReminderErrorReason
}> {}

const reminderErrorMessages = {
  save_failed: 'reminder.saveFailed',
  service_unavailable: 'reminder.serviceUnavailable',
  sign_in_first: 'reminder.signInFirst',
} as const satisfies Readonly<Record<ReminderErrorReason, TranslationKey>>

export function ReminderCard() {
  const { locale, t } = useI18n()
  const [state, setState] = useState<ReminderState>(() =>
    supportsPushNotifications() ? 'checking' : 'unsupported',
  )
  const [messageKey, setMessageKey] = useState<TranslationKey>('reminder.initial')

  useEffect(() => {
    if (!supportsPushNotifications()) return
    let active = true
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!active) return
        setState(subscription === null ? 'disabled' : 'enabled')
      })
      .catch(() => {
        if (active) setState('disabled')
      })
    return () => {
      active = false
    }
  }, [])

  if (state === 'unsupported') return null

  const enable = async () => {
    setState('working')
    setMessageKey('reminder.asking')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('disabled')
        setMessageKey('reminder.blocked')
        return
      }
      const [registration, configResponse] = await Promise.all([
        navigator.serviceWorker.ready,
        fetch('/api/v1/notifications/config'),
      ])
      if (!configResponse.ok) {
        throw new ReminderEnableError({ reason: 'service_unavailable' })
      }
      const config = (await configResponse.json()) as { publicKey: string }
      const subscription = await createPushSubscription(registration, config.publicKey)
      const response = await saveReminderSubscription(subscription, locale)
      if (!response.ok) {
        await subscription.unsubscribe()
        throw new ReminderEnableError({
          reason: response.status === 401 ? 'sign_in_first' : 'save_failed',
        })
      }
      setState('enabled')
      setMessageKey('reminder.daily')
    } catch (error) {
      setState('disabled')
      setMessageKey(
        error instanceof ReminderEnableError
          ? reminderErrorMessages[error.reason]
          : 'reminder.enableFailed',
      )
    }
  }

  if (state === 'enabled') return null

  return (
    <aside className="reminder-card">
      <span aria-hidden="true" className="reminder-bell">
        ♡
      </span>
      <div>
        <strong>{t('reminder.title')}</strong>
        <p>{t(messageKey)}</p>
      </div>
      <button
        disabled={state === 'checking' || state === 'working'}
        onClick={() => void enable()}
        type="button"
      >
        {state === 'working' ? t('reminder.wait') : t('reminder.turnOn')}
      </button>
    </aside>
  )
}

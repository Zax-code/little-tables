import { describe, expect, it } from 'vitest'

import { localReminderClock, reminderCopy, reminderIsDue } from './daily-reminders.js'
import type { PushSubscriptionRecord } from '../repositories/attempt-repository.js'

const subscription = (overrides: Partial<PushSubscriptionRecord> = {}): PushSubscriptionRecord => ({
  endpoint: 'https://push.example/subscription',
  expirationTime: null,
  keys: { auth: 'auth', p256dh: 'p256dh' },
  lastSentDayKey: null,
  locale: 'fr',
  profileId: 'lou',
  reminderHour: 18,
  timezone: 'Europe/Paris',
  ...overrides,
})

describe('daily reminders', () => {
  it('uses the subscription timezone for the local schedule', () => {
    expect(localReminderClock(new Date('2026-07-13T16:00:00Z'), 'Europe/Paris')).toEqual({
      dayKey: '2026-07-13',
      hour: 18,
    })
  })

  it('becomes due after 18:00 local time and only once per local day', () => {
    const now = new Date('2026-07-13T16:05:00Z')
    expect(reminderIsDue(subscription(), now)).toBe(true)
    expect(reminderIsDue(subscription({ lastSentDayKey: '2026-07-13' }), now)).toBe(false)
    expect(reminderIsDue(subscription(), new Date('2026-07-13T15:59:00Z'))).toBe(false)
  })

  it('uses warm French reminders by default and preserves an English choice', () => {
    expect(reminderCopy('fr').body).toBe('Une petite séance fera pousser ton jardin ♡')
    expect(reminderCopy('en').body).toBe('A tiny tables win will make your garden grow ♡')
  })
})

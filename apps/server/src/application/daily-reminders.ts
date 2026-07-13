import { Effect, Layer } from 'effect'
import webPush from 'web-push'

import {
  AttemptRepository,
  type AttemptRepositoryService,
  type PushSubscriptionRecord,
} from '../repositories/attempt-repository.js'

export type ReminderClock = Readonly<{
  dayKey: string
  hour: number
}>

export const localReminderClock = (now: Date, timezone: string): ReminderClock => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    dayKey: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
  }
}

export const reminderIsDue = (subscription: PushSubscriptionRecord, now: Date): boolean => {
  const local = localReminderClock(now, subscription.timezone)
  return local.hour >= subscription.reminderHour && local.dayKey !== subscription.lastSentDayKey
}

const practicedOnLocalDay = (
  attempts: ReadonlyArray<Readonly<{ answeredAt: Date }>>,
  dayKey: string,
  timezone: string,
) => attempts.some(({ answeredAt }) => localReminderClock(answeredAt, timezone).dayKey === dayKey)

type VapidConfig = Readonly<{
  privateKey: string
  publicKey: string
  subject: string
}>

const sendDueReminders = async (repository: AttemptRepositoryService, now: Date): Promise<void> => {
  const subscriptions = await Effect.runPromise(repository.listPushSubscriptions())
  for (const subscription of subscriptions) {
    if (!reminderIsDue(subscription, now)) continue
    const { dayKey } = localReminderClock(now, subscription.timezone)
    const attempts = await Effect.runPromise(repository.list(subscription.profileId))
    if (practicedOnLocalDay(attempts, dayKey, subscription.timezone)) {
      await Effect.runPromise(repository.markPushSubscriptionSent(subscription.endpoint, dayKey))
      continue
    }
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: subscription.keys,
        },
        JSON.stringify({
          body: 'A tiny tables win will make your garden grow ♡',
          icon: '/icons/icon-192.png',
          tag: `little-tables-${dayKey}`,
          title: 'little tables.',
          url: '/',
        }),
        { TTL: 60 * 60 * 6, urgency: 'normal' },
      )
      await Effect.runPromise(repository.markPushSubscriptionSent(subscription.endpoint, dayKey))
    } catch (error) {
      const statusCode =
        typeof error === 'object' && error !== null && 'statusCode' in error
          ? (error as { statusCode?: unknown }).statusCode
          : undefined
      if (statusCode === 404 || statusCode === 410) {
        await Effect.runPromise(repository.removePushSubscription(subscription.endpoint))
      } else {
        console.error('Daily reminder delivery failed', error)
      }
    }
  }
}

const layer = (config: VapidConfig) => {
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  return Layer.scopedDiscard(
    Effect.gen(function* () {
      const repository = yield* AttemptRepository
      let running = false
      const run = async () => {
        if (running) return
        running = true
        try {
          await sendDueReminders(repository, new Date())
        } catch (error) {
          console.error('Daily reminder worker failed', error)
        } finally {
          running = false
        }
      }
      const interval = yield* Effect.acquireRelease(
        Effect.sync(() => {
          void run()
          return setInterval(() => void run(), 60_000)
        }),
        (timer) => Effect.sync(() => clearInterval(timer)),
      )
      void interval
      return yield* Effect.never
    }),
  )
}

export const DailyReminders = { layer } as const

import { describe, expect, it } from 'vitest'

import { deriveDailyPracticeView } from './daily-practice-view-model.js'

describe('deriveDailyPracticeView', () => {
  it('treats any three of the last seven local days as a blooming week', () => {
    const view = deriveDailyPracticeView({
      activeSession: null,
      practiceDayKeys: ['2026-07-10', '2026-07-13', '2026-07-16'],
      rewardedDayKeys: ['2026-07-10', '2026-07-13', '2026-07-16'],
      todayKey: '2026-07-16',
    })

    expect(view.week.map(({ dayKey }) => dayKey)).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
    ])
    expect(view.weeklyPracticeDays).toBe(3)
    expect(view.visitsUntilBloomingWeek).toBe(0)
    expect(view.dailyWateringDone).toBe(true)
    expect(view.petalCount).toBe(5)
  })

  it('shows partial petals only for an active daily watering', () => {
    const view = deriveDailyPracticeView({
      activeSession: {
        currentIndex: 3,
        kind: 'daily-watering',
        questionCount: 8,
      },
      practiceDayKeys: ['2026-07-15'],
      rewardedDayKeys: [],
      todayKey: '2026-07-16',
    })

    expect(view.dailyWateringDone).toBe(false)
    expect(view.petalCount).toBe(2)
  })

  it('recognizes a gentle comeback without erasing earlier work', () => {
    const short = deriveDailyPracticeView({
      activeSession: null,
      practiceDayKeys: ['2026-07-12'],
      rewardedDayKeys: ['2026-07-12'],
      todayKey: '2026-07-16',
    })
    const long = deriveDailyPracticeView({
      activeSession: null,
      practiceDayKeys: ['2026-06-30'],
      rewardedDayKeys: ['2026-06-30'],
      todayKey: '2026-07-16',
    })

    expect(short.comeback).toBe('short')
    expect(long.comeback).toBe('long')
    expect(short.totalRewardedDays).toBe(1)
  })
})

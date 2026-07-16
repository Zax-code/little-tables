import { afterEach, describe, expect, it, vi } from 'vitest'

import { scheduleInitialSync } from './initial-sync.js'

describe('initial sync scheduling', () => {
  afterEach(() => vi.useRealTimers())

  it('defers initial sync beyond the first interaction window', async () => {
    vi.useFakeTimers()
    const sync = vi.fn()

    scheduleInitialSync(sync)
    await vi.advanceTimersByTimeAsync(1_499)
    expect(sync).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(sync).toHaveBeenCalledOnce()
  })

  it('cancels the deferred sync when its owner unmounts', async () => {
    vi.useFakeTimers()
    const sync = vi.fn()

    const cancel = scheduleInitialSync(sync)
    cancel()
    await vi.runAllTimersAsync()

    expect(sync).not.toHaveBeenCalled()
  })
})

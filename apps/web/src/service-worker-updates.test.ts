import { describe, expect, it, vi } from 'vitest'

import { startServiceWorkerUpdateChecks } from './service-worker-updates.js'

describe('startServiceWorkerUpdateChecks', () => {
  it('checks immediately, every minute, and whenever the app becomes active', async () => {
    const windowListeners = new Map<string, EventListener>()
    const documentListeners = new Map<string, EventListener>()
    let intervalCheck: (() => void) | undefined
    const registration = { update: vi.fn(() => Promise.resolve()) }
    const windowTarget = {
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        windowListeners.set(type, listener)
      }),
      clearInterval: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn((handler: () => void) => {
        intervalCheck = handler
        return 7
      }),
    }
    const documentTarget = {
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        documentListeners.set(type, listener)
      }),
      removeEventListener: vi.fn(),
      visibilityState: 'visible' as DocumentVisibilityState,
    }

    const stop = startServiceWorkerUpdateChecks(registration, {
      documentTarget,
      windowTarget,
    })

    expect(registration.update).toHaveBeenCalledOnce()
    expect(windowTarget.setInterval).toHaveBeenCalledWith(expect.any(Function), 60_000)

    if (typeof intervalCheck === 'function') intervalCheck()
    windowListeners.get('focus')?.(new Event('focus'))
    windowListeners.get('online')?.(new Event('online'))
    documentListeners.get('visibilitychange')?.(new Event('visibilitychange'))
    await Promise.resolve()

    expect(registration.update).toHaveBeenCalledTimes(5)

    stop()
    expect(windowTarget.clearInterval).toHaveBeenCalledWith(7)
    expect(windowTarget.removeEventListener).toHaveBeenCalledTimes(2)
    expect(documentTarget.removeEventListener).toHaveBeenCalledOnce()
  })

  it('does not make background update requests until the app is visible', () => {
    const registration = { update: vi.fn(() => Promise.resolve()) }
    const windowTarget = {
      addEventListener: vi.fn(),
      clearInterval: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 3),
    }
    const documentTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: 'hidden' as DocumentVisibilityState,
    }

    startServiceWorkerUpdateChecks(registration, { documentTarget, windowTarget })

    expect(registration.update).not.toHaveBeenCalled()
  })
})

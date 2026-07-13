import type { AttemptEvent } from '@little-tables/domain'
import { describe, expect, it, vi } from 'vitest'

import { flushPendingAttempts } from './sync.js'

const attempt: AttemptEvent = {
  answerMode: 'choice',
  answeredAt: new Date('2026-07-12T12:00:00.000Z'),
  choices: [48, 54, 56, 64],
  correct: true,
  eventId: 'attempt-1',
  factKey: '7:8',
  latencyMs: 1500,
  left: 7,
  right: 8,
  selected: 56,
  sequence: 0,
  sessionId: 'session-1',
}

describe('flushPendingAttempts', () => {
  it('acknowledges accepted, duplicate, and permanently rejected attempts', async () => {
    const acknowledge = vi.fn<(ids: ReadonlyArray<string>) => Promise<void>>().mockResolvedValue()
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: ['attempt-1'],
          duplicates: [],
          rejected: [{ eventId: 'attempt-bad', reason: 'invalid_answer' }],
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    )

    const result = await flushPendingAttempts({
      fetcher,
      profileId: 'lou',
      store: {
        acknowledge,
        pendingBatch: vi.fn().mockResolvedValue({ attempts: [attempt] }),
      },
    })

    expect(result.status).toBe('synced')
    expect(acknowledge).toHaveBeenCalledWith(['attempt-1', 'attempt-bad'])
  })
})

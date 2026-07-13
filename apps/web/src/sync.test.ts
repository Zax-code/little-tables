import type { AttemptEvent } from '@little-tables/domain'
import { describe, expect, it, vi } from 'vitest'

import { flushAllPendingAttempts, flushPendingAttempts } from './sync.js'

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
  questionCount: 10,
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

  it('does not acknowledge malformed server responses', async () => {
    const acknowledge = vi.fn<(ids: ReadonlyArray<string>) => Promise<void>>().mockResolvedValue()
    await expect(
      flushPendingAttempts({
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response(JSON.stringify({ accepted: [null], duplicates: [], rejected: [] })),
          ),
        profileId: 'lou',
        store: {
          acknowledge,
          pendingBatch: vi.fn().mockResolvedValue({ attempts: [attempt] }),
        },
      }),
    ).rejects.toBeDefined()
    expect(acknowledge).not.toHaveBeenCalled()
  })

  it('flushes every full outbox batch before canonical reconciliation', async () => {
    let remaining = 101
    const fetcher: typeof fetch = (_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected JSON request body')
      const sent = (JSON.parse(init.body) as { attempts: AttemptEvent[] }).attempts
      return Promise.resolve(
        new Response(
          JSON.stringify({
            accepted: sent.map(({ eventId }) => eventId),
            duplicates: [],
            rejected: [],
          }),
        ),
      )
    }
    const acknowledge = (ids: ReadonlyArray<string>): Promise<void> => {
      remaining -= ids.length
      return Promise.resolve()
    }
    const pendingBatch = (
      limit: number,
    ): Promise<Readonly<{ attempts: ReadonlyArray<AttemptEvent> }>> =>
      Promise.resolve({
        attempts: Array.from({ length: Math.min(limit, remaining) }, (_, index) => ({
          ...attempt,
          eventId: `batch-${remaining}-${index}`,
        })),
      })
    const result = await flushAllPendingAttempts({
      fetcher,
      profileId: 'lou',
      store: {
        acknowledge,
        pendingBatch,
      },
    })

    expect(result.acknowledged).toBe(101)
    expect(remaining).toBe(0)
  })
})

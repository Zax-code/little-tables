import { HttpApp } from '@effect/platform'
import { NodeHttpPlatform } from '@effect/platform-node'
import { Ce2Engine, type AttemptEvent, type Ce2Attempt } from '@little-tables/domain'
import { Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import { InMemoryAllowedEmailRepository } from '../repositories/in-memory-allowed-email-repository.js'
import { InMemoryAttemptRepository } from '../repositories/in-memory-attempt-repository.js'
import { InMemoryGardenCollectionRepository } from '../repositories/in-memory-garden-collection-repository.js'
import { InMemoryProfileRepository } from '../repositories/in-memory-profile-repository.js'
import { httpApp } from './app.js'

const webHandler = () =>
  HttpApp.toWebHandlerLayer(
    httpApp,
    Layer.mergeAll(
      NodeHttpPlatform.layer,
      InMemoryAttemptRepository.layer(),
      InMemoryAllowedEmailRepository.layer(),
      InMemoryGardenCollectionRepository.layer(),
      InMemoryProfileRepository.layer(),
    ),
  )

const completedCe2Session = (): ReadonlyArray<Ce2Attempt> => {
  let session = Ce2Engine.createSession({
    kind: 'daily-watering',
    module: 'fractions',
    now: new Date('2026-10-04T12:00:00.000Z'),
    seed: 991,
    skill: 'F2',
    snapshot: Ce2Engine.emptySnapshot(),
    timeZone: 'UTC',
  })
  const attempts: Ce2Attempt[] = []
  while (session.currentIndex < session.questions.length) {
    const question = session.questions[session.currentIndex]
    if (question === undefined) throw new Error('Expected CE2 question')
    const result = Ce2Engine.answer({
      answer: question.solution,
      answeredAt: new Date(
        `2026-10-04T12:00:${String(session.currentIndex + 1).padStart(2, '0')}.000Z`,
      ),
      assistance: {
        guided: false,
        helpOpened: false,
        representationHints: 0,
        resultRevealed: false,
        switchedToFree: false,
      },
      eventId: `ce2-http-${session.currentIndex}`,
      session,
    })
    attempts.push(result.attempt)
    session = { ...result.session, lastResult: null }
  }
  return attempts
}

describe('CE2 HTTP interface', () => {
  it('negotiates v2, syncs CE2 wire events, and keeps v1 output legacy-compatible', async () => {
    const { dispose, handler } = webHandler()
    const attempts = completedCe2Session()
    const sync = await handler(
      new Request('http://little-tables.local/api/v2/attempts/sync', {
        body: JSON.stringify({
          attempts,
          preferenceUpdates: [
            {
              enabledModules: ['fractions'],
              eventId: 'ce2-pref-http',
              lastDailyFamily: 'fractions',
              schemaVersion: 'ce2-preference-update/v1',
              updatedAt: '2026-10-04T12:01:00.000Z',
            },
          ],
          profileId: 'child-http',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    const v2 = await handler(
      new Request('http://little-tables.local/api/v2/bootstrap', {
        headers: { 'x-little-tables-profile-id': 'child-http' },
      }),
    )
    const v2Body = (await v2.json()) as Record<string, unknown>
    const v1 = await handler(
      new Request('http://little-tables.local/api/v1/bootstrap', {
        headers: { 'x-little-tables-profile-id': 'child-http' },
      }),
    )
    const v1Body = (await v1.json()) as Record<string, unknown>
    await dispose()

    expect(sync.status).toBe(200)
    expect(await sync.json()).toMatchObject({
      accepted: [...attempts.map(({ eventId }) => eventId), 'ce2-pref-http'],
      duplicates: [],
      rejected: [],
    })
    expect(v2.status).toBe(200)
    expect(v2Body).toMatchObject({
      capabilities: { ce2: { contentVersion: 'ce2-2026-v1' } },
      ce2ContentVersion: 'ce2-2026-v1',
      ce2Preferences: {
        enabledModules: ['fractions'],
        lastDailyFamily: 'fractions',
      },
      ce2Snapshot: { processedEventIds: attempts.map(({ eventId }) => eventId) },
      completedSessions: 1,
      gardenBloomCount: 1,
      rewardedDayKeys: ['2026-10-04'],
    })
    expect(v1.status).toBe(200)
    expect(v1Body).not.toHaveProperty('ce2Snapshot')
    expect(v1Body).toMatchObject({ completedSessions: 1, gardenBloomCount: 1 })
  })

  it('caps the common daily garden reward across legacy and CE2 sessions', async () => {
    const { dispose, handler } = webHandler()
    const legacy: AttemptEvent = {
      answerMode: 'keypad',
      answeredAt: new Date('2026-10-04T10:00:00.000Z'),
      choices: [],
      correct: true,
      eventId: 'legacy-daily-http',
      factKey: '7:8',
      latencyMs: 500,
      learningDayKey: '2026-10-04',
      left: 7,
      operation: 'multiply',
      questionCount: 1,
      right: 8,
      selected: 56,
      sequence: 0,
      sessionId: 'legacy-session-http',
      sessionKind: 'daily-watering',
    }
    await handler(
      new Request('http://little-tables.local/api/v1/attempts/sync', {
        body: JSON.stringify({ attempts: [legacy], profileId: 'child-cap' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    await handler(
      new Request('http://little-tables.local/api/v2/attempts/sync', {
        body: JSON.stringify({
          attempts: completedCe2Session(),
          preferenceUpdates: [],
          profileId: 'child-cap',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    )
    const response = await handler(
      new Request('http://little-tables.local/api/v2/bootstrap', {
        headers: { 'x-little-tables-profile-id': 'child-cap' },
      }),
    )
    const body: unknown = await response.json()
    await dispose()

    expect(body).toMatchObject({
      completedSessions: 2,
      gardenBloomCount: 1,
      rewardedDayKeys: ['2026-10-04'],
    })
  })
})

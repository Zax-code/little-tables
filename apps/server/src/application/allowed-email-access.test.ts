import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { InMemoryAllowedEmailRepository } from '../repositories/in-memory-allowed-email-repository.js'
import { AllowedEmailAccess } from './allowed-email-access.js'

describe('AllowedEmailAccess', () => {
  it('lets the owner grant sign-in access using a normalized email address', async () => {
    const program = Effect.gen(function* () {
      expect(yield* AllowedEmailAccess.isAllowed('new.user@example.com', [])).toBe(false)
      const result = yield* AllowedEmailAccess.add({
        actorEmail: ' BOOMSLANG.A@GMAIL.COM ',
        email: ' New.User@Example.com ',
      })
      expect(yield* AllowedEmailAccess.isAllowed('NEW.USER@EXAMPLE.COM', [])).toBe(true)
      return result
    }).pipe(Effect.provide(InMemoryAllowedEmailRepository.layer()))

    await expect(Effect.runPromise(program)).resolves.toEqual({
      created: true,
      email: 'new.user@example.com',
    })
  })

  it('lists configured and persisted addresses only for the owner', async () => {
    const program = Effect.gen(function* () {
      yield* AllowedEmailAccess.add({
        actorEmail: 'boomslang.a@gmail.com',
        email: 'new.user@example.com',
      })
      return yield* AllowedEmailAccess.list({
        actorEmail: 'boomslang.a@gmail.com',
        configuredEmails: ['LEARNER@example.com', 'new.user@example.com'],
      })
    }).pipe(Effect.provide(InMemoryAllowedEmailRepository.layer()))

    await expect(Effect.runPromise(program)).resolves.toEqual([
      'boomslang.a@gmail.com',
      'learner@example.com',
      'new.user@example.com',
    ])
  })

  it('rejects management attempts from every non-owner email', async () => {
    const program = AllowedEmailAccess.add({
      actorEmail: 'learner@example.com',
      email: 'friend@example.com',
    }).pipe(Effect.flip, Effect.provide(InMemoryAllowedEmailRepository.layer()))

    await expect(Effect.runPromise(program)).resolves.toMatchObject({ reason: 'forbidden' })
  })
})

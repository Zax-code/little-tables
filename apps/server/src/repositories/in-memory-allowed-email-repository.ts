import { Effect, Layer } from 'effect'

import {
  AllowedEmailRepository,
  type AllowedEmailRepositoryService,
} from './allowed-email-repository.js'

const layer = () => {
  const emails = new Set<string>()
  const blockedEmails = new Set<string>()
  const sessionVersions = new Map<string, number>()
  const service: AllowedEmailRepositoryService = {
    add: (email) =>
      Effect.sync(() => {
        const created = !emails.has(email)
        emails.add(email)
        blockedEmails.delete(email)
        return created
      }),
    contains: (email) => Effect.sync(() => emails.has(email)),
    isBlocked: (email) => Effect.sync(() => blockedEmails.has(email)),
    list: () => Effect.sync(() => [...emails].sort()),
    listBlocked: () => Effect.sync(() => [...blockedEmails].sort()),
    remove: (email) =>
      Effect.sync(() => {
        emails.delete(email)
        blockedEmails.add(email)
        sessionVersions.set(email, (sessionVersions.get(email) ?? 0) + 1)
      }),
    sessionVersion: (email) => Effect.sync(() => sessionVersions.get(email) ?? 0),
  }
  return Layer.succeed(AllowedEmailRepository, service)
}

export const InMemoryAllowedEmailRepository = { layer } as const

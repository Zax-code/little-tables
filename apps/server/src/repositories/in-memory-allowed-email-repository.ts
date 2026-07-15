import { Effect, Layer } from 'effect'

import {
  AllowedEmailRepository,
  type AllowedEmailRepositoryService,
} from './allowed-email-repository.js'

const layer = () => {
  const emails = new Set<string>()
  const service: AllowedEmailRepositoryService = {
    add: (email) =>
      Effect.sync(() => {
        const created = !emails.has(email)
        emails.add(email)
        return created
      }),
    contains: (email) => Effect.sync(() => emails.has(email)),
    list: () => Effect.sync(() => [...emails].sort()),
  }
  return Layer.succeed(AllowedEmailRepository, service)
}

export const InMemoryAllowedEmailRepository = { layer } as const

import { Data, Effect } from 'effect'

import { AllowedEmailRepository } from '../repositories/allowed-email-repository.js'

export const administratorEmail = 'boomslang.a@gmail.com'

export class AllowedEmailAccessError extends Data.TaggedError('AllowedEmailAccessError')<{
  reason: 'forbidden' | 'invalid_email'
}> {}

const normalizeEmail = (email: string): string | null => {
  const normalized = email.trim().toLocaleLowerCase('en-US')
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return null
  }
  return normalized
}

const isAdministrator = (email: string): boolean => normalizeEmail(email) === administratorEmail

const isAllowed = (email: string, configuredEmails: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const normalized = normalizeEmail(email)
    if (normalized === null) return false
    if (normalized === administratorEmail) return true
    if (configuredEmails.some((configured) => normalizeEmail(configured) === normalized))
      return true
    const repository = yield* AllowedEmailRepository
    return yield* repository.contains(normalized)
  })

const add = ({ actorEmail, email }: Readonly<{ actorEmail: string; email: string }>) =>
  Effect.gen(function* () {
    if (!isAdministrator(actorEmail)) {
      return yield* new AllowedEmailAccessError({ reason: 'forbidden' })
    }
    const normalized = normalizeEmail(email)
    if (normalized === null) {
      return yield* new AllowedEmailAccessError({ reason: 'invalid_email' })
    }
    const repository = yield* AllowedEmailRepository
    const created = yield* repository.add(normalized, administratorEmail)
    return { created, email: normalized } as const
  })

const list = ({
  actorEmail,
  configuredEmails,
}: Readonly<{ actorEmail: string; configuredEmails: ReadonlyArray<string> }>) =>
  Effect.gen(function* () {
    if (!isAdministrator(actorEmail)) {
      return yield* new AllowedEmailAccessError({ reason: 'forbidden' })
    }
    const repository = yield* AllowedEmailRepository
    const storedEmails = yield* repository.list()
    const emails = new Set([administratorEmail, ...storedEmails])
    for (const configuredEmail of configuredEmails) {
      const normalized = normalizeEmail(configuredEmail)
      if (normalized !== null) emails.add(normalized)
    }
    return [...emails].sort()
  })

export const AllowedEmailAccess = { add, isAdministrator, isAllowed, list } as const

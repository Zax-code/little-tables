import { Data, Effect } from 'effect'

import { AllowedEmailRepository } from '../repositories/allowed-email-repository.js'

export const administratorEmail = 'boomslang.a@gmail.com'

export class AllowedEmailAccessError extends Data.TaggedError('AllowedEmailAccessError')<{
  reason: 'forbidden' | 'invalid_email' | 'protected_email'
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
    const repository = yield* AllowedEmailRepository
    if (yield* repository.isBlocked(normalized)) return false
    if (configuredEmails.some((configured) => normalizeEmail(configured) === normalized))
      return true
    return yield* repository.contains(normalized)
  })

const sessionVersion = (email: string) =>
  Effect.gen(function* () {
    const normalized = normalizeEmail(email)
    if (normalized === null || normalized === administratorEmail) return 0
    const repository = yield* AllowedEmailRepository
    return yield* repository.sessionVersion(normalized)
  })

const isSessionAllowed = (
  email: string,
  version: number,
  configuredEmails: ReadonlyArray<string>,
) =>
  Effect.gen(function* () {
    if (!(yield* isAllowed(email, configuredEmails))) return false
    return (yield* sessionVersion(email)) === version
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
    const blockedEmails = new Set(yield* repository.listBlocked())
    const emails = new Set([administratorEmail, ...storedEmails])
    for (const configuredEmail of configuredEmails) {
      const normalized = normalizeEmail(configuredEmail)
      if (normalized !== null && !blockedEmails.has(normalized)) emails.add(normalized)
    }
    return [...emails].sort()
  })

const remove = ({
  actorEmail,
  configuredEmails,
  email,
}: Readonly<{
  actorEmail: string
  configuredEmails: ReadonlyArray<string>
  email: string
}>) =>
  Effect.gen(function* () {
    if (!isAdministrator(actorEmail)) {
      return yield* new AllowedEmailAccessError({ reason: 'forbidden' })
    }
    const normalized = normalizeEmail(email)
    if (normalized === null) {
      return yield* new AllowedEmailAccessError({ reason: 'invalid_email' })
    }
    if (normalized === administratorEmail) {
      return yield* new AllowedEmailAccessError({ reason: 'protected_email' })
    }
    const wasAllowed = yield* isAllowed(normalized, configuredEmails)
    const repository = yield* AllowedEmailRepository
    yield* repository.remove(normalized, administratorEmail)
    return { email: normalized, removed: wasAllowed } as const
  })

export const AllowedEmailAccess = {
  add,
  isAdministrator,
  isAllowed,
  isSessionAllowed,
  list,
  remove,
  sessionVersion,
} as const

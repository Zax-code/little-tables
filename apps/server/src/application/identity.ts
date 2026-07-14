import { createHmac, timingSafeEqual } from 'node:crypto'

type VerifyInput = Readonly<{
  now: Date
  secret: string
  session: string
}>

type IssueInput = Readonly<{
  authMethod: 'google'
  displayName: string
  googleSubject: string
  now: Date
  profileId: 'lou'
  secret: string
}>

const digest = (value: string, secret: string): Buffer =>
  createHmac('sha256', secret).update(value).digest()

const equalDigest = (first: Buffer, second: Buffer): boolean =>
  first.length === second.length && timingSafeEqual(first, second)

const issue = ({
  authMethod,
  displayName,
  googleSubject,
  now,
  profileId,
  secret,
}: IssueInput): string => {
  const expiresAt = now.getTime() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(
    JSON.stringify({ authMethod, displayName, expiresAt, googleSubject, profileId }),
  ).toString('base64url')
  const signature = digest(payload, secret).toString('base64url')
  return `${payload}.${signature}`
}

const verify = ({
  now,
  secret,
  session,
}: VerifyInput): Readonly<{
  authMethod: 'google'
  displayName: string
  expiresAt: number
  googleSubject: string
  profileId: 'lou'
}> | null => {
  const [payload, signature, extra] = session.split('.')
  if (payload === undefined || signature === undefined || extra !== undefined) return null
  if (!equalDigest(digest(payload, secret), Buffer.from(signature, 'base64url'))) return null
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof value !== 'object' || value === null) return null
    const record = value as Record<string, unknown>
    if (
      record.authMethod !== 'google' ||
      typeof record.displayName !== 'string' ||
      record.displayName.trim() === '' ||
      typeof record.googleSubject !== 'string' ||
      record.googleSubject.trim() === '' ||
      record.profileId !== 'lou' ||
      typeof record.expiresAt !== 'number'
    ) {
      return null
    }
    if (record.expiresAt <= now.getTime()) return null
    return {
      authMethod: 'google',
      displayName: record.displayName,
      expiresAt: record.expiresAt,
      googleSubject: record.googleSubject,
      profileId: 'lou',
    }
  } catch {
    return null
  }
}

const renew = (input: VerifyInput): string | null => {
  const identity = verify(input)
  return identity === null
    ? null
    : issue({
        authMethod: identity.authMethod,
        displayName: identity.displayName,
        googleSubject: identity.googleSubject,
        now: input.now,
        profileId: identity.profileId,
        secret: input.secret,
      })
}

export const Identity = { issue, renew, verify } as const

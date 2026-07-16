import { createHmac, timingSafeEqual } from 'node:crypto'
import { Either, Schema } from 'effect'

type VerifyInput = Readonly<{
  now: Date
  secret: string
  session: string
}>

type IssueInput = Readonly<{
  authMethod: 'google'
  displayName: string
  email: string
  googleSubject: string
  now: Date
  profileId: 'lou'
  secret: string
  sessionVersion?: number
}>

const SessionPayloadSchema = Schema.Struct({
  authMethod: Schema.Literal('google'),
  displayName: Schema.NonEmptyString,
  email: Schema.NonEmptyString,
  expiresAt: Schema.NonNegative,
  googleSubject: Schema.NonEmptyString,
  profileId: Schema.Literal('lou'),
  sessionVersion: Schema.optional(Schema.NonNegativeInt),
})

const digest = (value: string, secret: string): Buffer =>
  createHmac('sha256', secret).update(value).digest()

const equalDigest = (first: Buffer, second: Buffer): boolean =>
  first.length === second.length && timingSafeEqual(first, second)

const issue = ({
  authMethod,
  displayName,
  email,
  googleSubject,
  now,
  profileId,
  secret,
  sessionVersion = 0,
}: IssueInput): string => {
  const expiresAt = now.getTime() + 30 * 24 * 60 * 60 * 1000
  const sessionPayload = Schema.encodeSync(SessionPayloadSchema)({
    authMethod,
    displayName,
    email,
    expiresAt,
    googleSubject,
    profileId,
    sessionVersion,
  })
  const payload = Buffer.from(JSON.stringify(sessionPayload)).toString('base64url')
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
  email: string
  expiresAt: number
  googleSubject: string
  profileId: 'lou'
  sessionVersion: number
}> | null => {
  const [payload, signature, extra] = session.split('.')
  if (payload === undefined || signature === undefined || extra !== undefined) return null
  if (!equalDigest(digest(payload, secret), Buffer.from(signature, 'base64url'))) return null
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const decoded = Schema.decodeUnknownEither(SessionPayloadSchema)(value)
    if (Either.isLeft(decoded)) return null
    const record = decoded.right
    if (
      record.displayName.trim() === '' ||
      record.email.trim() === '' ||
      record.googleSubject.trim() === '' ||
      record.expiresAt <= now.getTime()
    ) {
      return null
    }
    return {
      authMethod: 'google',
      displayName: record.displayName,
      email: record.email,
      expiresAt: record.expiresAt,
      googleSubject: record.googleSubject,
      profileId: 'lou',
      sessionVersion: record.sessionVersion ?? 0,
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
        email: identity.email,
        googleSubject: identity.googleSubject,
        now: input.now,
        profileId: identity.profileId,
        secret: input.secret,
        sessionVersion: identity.sessionVersion,
      })
}

export const Identity = { issue, renew, verify } as const

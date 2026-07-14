import { createHmac, timingSafeEqual } from 'node:crypto'

type ClaimInput = Readonly<{
  expectedInvite: string
  invite: string
  now: Date
  secret: string
}>

type VerifyInput = Readonly<{
  now: Date
  secret: string
  session: string
}>

type IssueInput = Readonly<{
  displayName: string
  now: Date
  profileId: 'lou'
  secret: string
}>

const digest = (value: string, secret: string): Buffer =>
  createHmac('sha256', secret).update(value).digest()

const equalDigest = (first: Buffer, second: Buffer): boolean =>
  first.length === second.length && timingSafeEqual(first, second)

const inviteId = (invite: string, secret: string): string =>
  digest(`invite:${invite}`, secret).toString('hex')

const claim = ({ expectedInvite, invite, now, secret }: ClaimInput): string | null => {
  if (!equalDigest(digest(invite, secret), digest(expectedInvite, secret))) return null
  return issue({ displayName: 'léa', now, profileId: 'lou', secret })
}

const issue = ({ displayName, now, profileId, secret }: IssueInput): string => {
  const expiresAt = now.getTime() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ displayName, expiresAt, profileId })).toString(
    'base64url',
  )
  const signature = digest(payload, secret).toString('base64url')
  return `${payload}.${signature}`
}

const verify = ({
  now,
  secret,
  session,
}: VerifyInput): Readonly<{ displayName: string; profileId: 'lou' }> | null => {
  const [payload, signature, extra] = session.split('.')
  if (payload === undefined || signature === undefined || extra !== undefined) return null
  if (!equalDigest(digest(payload, secret), Buffer.from(signature, 'base64url'))) return null
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof value !== 'object' || value === null) return null
    const record = value as Record<string, unknown>
    if (record.profileId !== 'lou' || typeof record.expiresAt !== 'number') return null
    if (record.expiresAt <= now.getTime()) return null
    return {
      displayName:
        typeof record.displayName === 'string' && record.displayName.trim() !== ''
          ? record.displayName
          : 'léa',
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
        displayName: identity.displayName,
        now: input.now,
        profileId: identity.profileId,
        secret: input.secret,
      })
}

export const Identity = { claim, inviteId, issue, renew, verify } as const

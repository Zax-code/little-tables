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

const digest = (value: string, secret: string): Buffer =>
  createHmac('sha256', secret).update(value).digest()

const equalDigest = (first: Buffer, second: Buffer): boolean =>
  first.length === second.length && timingSafeEqual(first, second)

const inviteId = (invite: string, secret: string): string =>
  digest(`invite:${invite}`, secret).toString('hex')

const claim = ({ expectedInvite, invite, now, secret }: ClaimInput): string | null => {
  if (!equalDigest(digest(invite, secret), digest(expectedInvite, secret))) return null
  return issue(now, secret)
}

const issue = (now: Date, secret: string): string => {
  const expiresAt = now.getTime() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ expiresAt, profileId: 'lou' })).toString('base64url')
  const signature = digest(payload, secret).toString('base64url')
  return `${payload}.${signature}`
}

const verify = ({ now, secret, session }: VerifyInput): Readonly<{ profileId: string }> | null => {
  const [payload, signature, extra] = session.split('.')
  if (payload === undefined || signature === undefined || extra !== undefined) return null
  if (!equalDigest(digest(payload, secret), Buffer.from(signature, 'base64url'))) return null
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof value !== 'object' || value === null) return null
    const record = value as Record<string, unknown>
    if (record.profileId !== 'lou' || typeof record.expiresAt !== 'number') return null
    if (record.expiresAt <= now.getTime()) return null
    return { profileId: 'lou' }
  } catch {
    return null
  }
}

const renew = (input: VerifyInput): string | null =>
  verify(input) === null ? null : issue(input.now, input.secret)

export const Identity = { claim, inviteId, renew, verify } as const

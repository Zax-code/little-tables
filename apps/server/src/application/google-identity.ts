import { OAuth2Client } from 'google-auth-library'

type GoogleClaims = Readonly<{
  email?: string
  email_verified?: boolean
  given_name?: string
  name?: string
  sub?: string
}>

type VerifyGoogleCredentialInput = Readonly<{
  clientId: string
  credential: string
}>

const oauthClient = new OAuth2Client()

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === '' ? undefined : trimmed
}

export type GoogleIdentity = Readonly<{
  displayName: string
  email: string
  profileId: 'lou'
  subject: string
}>

export const googleIdentityFromClaims = (
  claims: GoogleClaims | undefined,
): GoogleIdentity | null => {
  const email = nonEmpty(claims?.email)?.toLocaleLowerCase('en-US')
  if (claims?.email_verified !== true || claims.sub === undefined || email === undefined) {
    return null
  }
  const googleName = nonEmpty(claims.given_name) ?? nonEmpty(claims.name)
  const emailName = nonEmpty(email.split('@')[0])
  const displayName = (googleName ?? emailName ?? 'léa').toLocaleLowerCase('en-US')
  return { displayName, email, profileId: 'lou', subject: claims.sub }
}

export const verifyGoogleCredential = async ({
  clientId,
  credential,
}: VerifyGoogleCredentialInput): Promise<GoogleIdentity | null> => {
  const ticket = await oauthClient.verifyIdToken({ audience: clientId, idToken: credential })
  return googleIdentityFromClaims(ticket.getPayload())
}

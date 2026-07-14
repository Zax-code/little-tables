import { OAuth2Client } from 'google-auth-library'

type GoogleClaims = Readonly<{
  email?: string
  email_verified?: boolean
  given_name?: string
  name?: string
  sub?: string
}>

type VerifyGoogleCredentialInput = Readonly<{
  allowedEmail: string
  clientId: string
  credential: string
}>

const oauthClient = new OAuth2Client()

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === '' ? undefined : trimmed
}

export const authorizeGoogleClaims = (
  claims: GoogleClaims | undefined,
  allowedEmail: string,
): Readonly<{ displayName: string; profileId: 'lou'; subject: string }> | null => {
  if (
    claims?.email_verified !== true ||
    claims.sub === undefined ||
    claims.email?.toLocaleLowerCase('en-US') !== allowedEmail.toLocaleLowerCase('en-US')
  ) {
    return null
  }
  const googleName = nonEmpty(claims.given_name) ?? nonEmpty(claims.name)
  const emailName = nonEmpty(claims.email.split('@')[0])
  const displayName = (googleName ?? emailName ?? 'léa').toLocaleLowerCase('en-US')
  return { displayName, profileId: 'lou', subject: claims.sub }
}

export const verifyGoogleCredential = async ({
  allowedEmail,
  clientId,
  credential,
}: VerifyGoogleCredentialInput): Promise<Readonly<{
  displayName: string
  profileId: 'lou'
  subject: string
}> | null> => {
  const ticket = await oauthClient.verifyIdToken({ audience: clientId, idToken: credential })
  return authorizeGoogleClaims(ticket.getPayload(), allowedEmail)
}

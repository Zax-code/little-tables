import { OAuth2Client } from 'google-auth-library'

type GoogleClaims = Readonly<{
  email?: string
  email_verified?: boolean
  given_name?: string
  name?: string
  sub?: string
}>

type VerifyGoogleCredentialInput = Readonly<{
  allowedEmails: ReadonlyArray<string>
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
  allowedEmails: ReadonlyArray<string>,
): Readonly<{ displayName: string; profileId: 'lou'; subject: string }> | null => {
  const email = claims?.email?.toLocaleLowerCase('en-US')
  if (
    claims?.email_verified !== true ||
    claims.sub === undefined ||
    email === undefined ||
    !allowedEmails.some((allowedEmail) => allowedEmail.toLocaleLowerCase('en-US') === email)
  ) {
    return null
  }
  const googleName = nonEmpty(claims.given_name) ?? nonEmpty(claims.name)
  const emailName = nonEmpty(email.split('@')[0])
  const displayName = (googleName ?? emailName ?? 'léa').toLocaleLowerCase('en-US')
  return { displayName, profileId: 'lou', subject: claims.sub }
}

export const verifyGoogleCredential = async ({
  allowedEmails,
  clientId,
  credential,
}: VerifyGoogleCredentialInput): Promise<Readonly<{
  displayName: string
  profileId: 'lou'
  subject: string
}> | null> => {
  const ticket = await oauthClient.verifyIdToken({ audience: clientId, idToken: credential })
  return authorizeGoogleClaims(ticket.getPayload(), allowedEmails)
}

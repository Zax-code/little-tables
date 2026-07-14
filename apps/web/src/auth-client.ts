import { Schema } from 'effect'

const AuthStatusSchema = Schema.Struct({
  authenticated: Schema.Boolean,
  authenticationRequired: Schema.Boolean,
  displayName: Schema.NullOr(Schema.String),
  googleClientId: Schema.NullOr(Schema.String),
})

export type AuthStatus = typeof AuthStatusSchema.Type

export const authStatusQueryKey = ['auth-status'] as const

export async function fetchAuthStatus(fetcher: typeof fetch = fetch): Promise<AuthStatus> {
  const response = await fetcher('/api/v1/auth/status')
  if (!response.ok) throw new Error(`Authentication check failed with status ${response.status}`)
  return Schema.decodeUnknownPromise(AuthStatusSchema)(await response.json())
}

export async function claimInvite(token: string, fetcher: typeof fetch = fetch): Promise<void> {
  const response = await fetcher('/api/v1/invites/claim', {
    body: JSON.stringify({ token }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) throw new Error('The private invite could not be claimed.')
}

export async function signInWithGoogle(
  credential: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher('/api/v1/auth/google', {
    body: JSON.stringify({ credential }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'That Google account is not allowed to open this garden.'
        : 'Google sign-in could not be completed.',
    )
  }
}

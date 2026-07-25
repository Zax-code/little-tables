import { Data, Schema } from 'effect'

import { clearFamilyProfileDeviceState } from './family-profile-device.js'

const AuthStatusSchema = Schema.Struct({
  authenticated: Schema.Boolean,
  authenticationRequired: Schema.Boolean,
  displayName: Schema.NullOr(Schema.String),
  googleClientId: Schema.NullOr(Schema.String),
  isAdmin: Schema.Boolean,
  nameChoiceRequired: Schema.Boolean,
  profileId: Schema.optional(Schema.NullOr(Schema.NonEmptyString)),
  sessionExpiresAt: Schema.NullOr(Schema.NonNegative),
})
const PreferredNameResponseSchema = Schema.Struct({ displayName: Schema.String })

export type AuthStatus = typeof AuthStatusSchema.Type

export const authStatusQueryKey = ['auth-status'] as const

export class GoogleSignInError extends Data.TaggedError('GoogleSignInError')<{
  reason: 'failed' | 'unauthorized'
}> {}

export class PreferredNameSaveError extends Data.TaggedError('PreferredNameSaveError')<{
  reason: 'already-chosen' | 'failed'
}> {}

export async function fetchAuthStatus(fetcher: typeof fetch = fetch): Promise<AuthStatus> {
  const response = await fetcher('/api/v1/auth/status')
  if (!response.ok) throw new Error(`Authentication check failed with status ${response.status}`)
  return Schema.decodeUnknownPromise(AuthStatusSchema)(await response.json())
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
    throw new GoogleSignInError({ reason: response.status === 401 ? 'unauthorized' : 'failed' })
  }
  clearFamilyProfileDeviceState()
}

export async function savePreferredName(
  displayName: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher('/api/v1/profile/name', {
    body: JSON.stringify({ displayName }),
    headers: { 'content-type': 'application/json' },
    method: 'PUT',
  })
  if (!response.ok) {
    throw new PreferredNameSaveError({
      reason: response.status === 409 ? 'already-chosen' : 'failed',
    })
  }
  const saved = await Schema.decodeUnknownPromise(PreferredNameResponseSchema)(
    await response.json(),
  )
  return saved.displayName
}

/**
 * The Effect client of `/api/v2`. Every response is decoded with the contract schemas; failures
 * are tagged so callers can tell a refusal (`ApiError`) from a lost connection (`NetworkError`).
 */
import type { AttemptEvent, LearningPathSettings } from '@little-tables/engine/schema'
import { Context, Data, Effect, Layer, Schema } from 'effect'
import { HttpClient, HttpClientRequest, type HttpClientError } from 'effect/http'

import {
  AllowedEmails,
  AuthStatus,
  Bootstrap,
  EmailAdded,
  EmailRemoved,
  Insights,
  IntroductionSeen,
  Logout,
  NotificationConfig,
  ParentLockDevice,
  ParentLockStatus,
  ProfileResponse,
  ProfilesResponse,
  Refresh,
  RemovedProfile,
  SignIn,
  Subscribed,
  SyncResult,
  Unsubscribed,
  type PushSubscriptionInput,
  type SelectableAvatarId,
} from './schema.js'

/** The server refused the request; `code` is its `error` field. */
export class ApiError extends Data.TaggedError('ApiError')<{
  readonly code: string
  /** Until when a locked parent code stays closed. */
  readonly lockedUntil?: number
  readonly message: string
  /** Wrong parent codes still allowed before it locks. */
  readonly remainingAttempts?: number
  readonly status: number
}> {}

/** The server could not be reached or answered something unreadable. */
export class NetworkError extends Data.TaggedError('NetworkError')<{ readonly cause: unknown }> {}

/** The server answered a body that does not match the contract. */
export class ContractError extends Data.TaggedError('ContractError')<{
  readonly cause: Schema.SchemaError
}> {}

export type ApiFailure = ApiError | ContractError | NetworkError

const ErrorBody = Schema.Struct({
  error: Schema.optional(Schema.String),
  lockedUntil: Schema.optional(Schema.Number),
  message: Schema.optional(Schema.String),
  remainingAttempts: Schema.optional(Schema.Number),
})

export type ProfileChanges = Readonly<{
  avatarId?: SelectableAvatarId
  name?: string
  reminderMinute?: number | null
}>

const make = (baseUrl: string) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient

    const call = <A>(
      schema: Schema.Decoder<A>,
      request: HttpClientRequest.HttpClientRequest,
    ): Effect.Effect<A, ApiFailure> =>
      http
        .execute(
          request.pipe(
            HttpClientRequest.prependUrl(baseUrl),
            HttpClientRequest.acceptJson,
            HttpClientRequest.setHeader('x-little-tables', '1'),
          ),
        )
        .pipe(
          Effect.flatMap(
            (response): Effect.Effect<A, ApiFailure | HttpClientError.HttpClientError> =>
              response.status >= 200 && response.status < 300
                ? response.json.pipe(
                    Effect.flatMap((body) =>
                      Schema.decodeUnknownEffect(schema)(body).pipe(
                        Effect.mapError((cause) => new ContractError({ cause })),
                      ),
                    ),
                  )
                : response.json.pipe(
                    Effect.flatMap(Schema.decodeUnknownEffect(ErrorBody)),
                    Effect.orElseSucceed((): typeof ErrorBody.Type => ({})),
                    Effect.flatMap((body) =>
                      Effect.fail(
                        new ApiError({
                          code: body.error ?? 'unknown',
                          message: body.message ?? '',
                          status: response.status,
                          ...(body.lockedUntil === undefined
                            ? {}
                            : { lockedUntil: body.lockedUntil }),
                          ...(body.remainingAttempts === undefined
                            ? {}
                            : { remainingAttempts: body.remainingAttempts }),
                        }),
                      ),
                    ),
                  ),
          ),
          // Unreachable, or an unreadable body: the request did not get through.
          Effect.catchTag('HttpClientError', (cause) => Effect.fail(new NetworkError({ cause }))),
        )

    const json = (request: HttpClientRequest.HttpClientRequest, body: unknown) =>
      HttpClientRequest.bodyJsonUnsafe(request, body)

    const profilePath = (profileId: string) => `/api/v2/profiles/${encodeURIComponent(profileId)}`
    const familyPath = (profileId: string) =>
      `/api/v2/family/profiles/${encodeURIComponent(profileId)}`

    return {
      addEmail: (email: string) =>
        call(EmailAdded, json(HttpClientRequest.post('/api/v2/admin/allowed-emails'), { email })),
      allowedEmails: () =>
        call(AllowedEmails, HttpClientRequest.get('/api/v2/admin/allowed-emails')),
      authStatus: () => call(AuthStatus, HttpClientRequest.get('/api/v2/auth/status')),
      bootstrap: (profileId: string) =>
        call(Bootstrap, HttpClientRequest.get(`${profilePath(profileId)}/bootstrap`)),
      createProfile: (input: Readonly<{ avatarId: SelectableAvatarId; name: string }>) =>
        call(ProfileResponse, json(HttpClientRequest.post('/api/v2/family/profiles'), input)),
      insights: (profileId: string, range: '7d' | '30d', today: string) =>
        call(
          Insights,
          HttpClientRequest.get(`${profilePath(profileId)}/insights`).pipe(
            HttpClientRequest.setUrlParams({ range, today }),
          ),
        ),
      introductionSeen: (profileId: string) =>
        call(
          IntroductionSeen,
          HttpClientRequest.post(`${profilePath(profileId)}/garden/introduction-seen`),
        ),
      logout: () => call(Logout, HttpClientRequest.post('/api/v2/auth/logout')),
      notificationConfig: () =>
        call(NotificationConfig, HttpClientRequest.get('/api/v2/notifications/config')),
      onboarding: (input: Readonly<{ avatarId?: SelectableAvatarId; name: string }>) =>
        call(ProfileResponse, json(HttpClientRequest.post('/api/v2/family/onboarding'), input)),
      parentLock: () => call(ParentLockStatus, HttpClientRequest.get('/api/v2/family/parent-lock')),
      /** Forgets the code; `credential` is a Google ID token from a sign-in made just now. */
      resetParentLock: (credential: string | null) =>
        call(
          ParentLockStatus,
          json(HttpClientRequest.delete('/api/v2/family/parent-lock'), { credential }),
        ),
      /** Sets the code, or changes it with the current one. */
      setParentLock: (pin: string, currentPin?: string) =>
        call(
          ParentLockDevice,
          json(
            HttpClientRequest.put('/api/v2/family/parent-lock'),
            currentPin === undefined ? { pin } : { currentPin, pin },
          ),
        ),
      verifyParentLock: (pin: string) =>
        call(
          ParentLockDevice,
          json(HttpClientRequest.post('/api/v2/family/parent-lock/verify'), { pin }),
        ),
      profiles: () => call(ProfilesResponse, HttpClientRequest.get('/api/v2/family/profiles')),
      refresh: () => call(Refresh, HttpClientRequest.post('/api/v2/auth/refresh')),
      removeEmail: (email: string) =>
        call(
          EmailRemoved,
          HttpClientRequest.delete(`/api/v2/admin/allowed-emails/${encodeURIComponent(email)}`),
        ),
      removeProfile: (profileId: string) =>
        call(RemovedProfile, HttpClientRequest.delete(familyPath(profileId))),
      signIn: (credential: string) =>
        call(SignIn, json(HttpClientRequest.post('/api/v2/auth/google'), { credential })),
      subscribe: (profileId: string, subscription: PushSubscriptionInput) =>
        call(
          Subscribed,
          json(
            HttpClientRequest.post(`${profilePath(profileId)}/notifications/subscriptions`),
            subscription,
          ),
        ),
      sync: (profileId: string, attempts: ReadonlyArray<AttemptEvent>) =>
        call(
          SyncResult,
          json(HttpClientRequest.post(`${profilePath(profileId)}/attempts`), { attempts }),
        ),
      unsubscribe: (profileId: string, endpoint: string) =>
        call(
          Unsubscribed,
          HttpClientRequest.delete(`${profilePath(profileId)}/notifications/subscriptions`).pipe(
            HttpClientRequest.setUrlParam('endpoint', endpoint),
          ),
        ),
      updateLearningPaths: (profileId: string, settings: LearningPathSettings) =>
        call(
          ProfileResponse,
          json(HttpClientRequest.put(`${familyPath(profileId)}/learning-paths`), settings),
        ),
      updateProfile: (profileId: string, changes: ProfileChanges) =>
        call(ProfileResponse, json(HttpClientRequest.patch(familyPath(profileId)), changes)),
    } as const
  })

export type ApiClientService = Effect.Success<ReturnType<typeof make>>

export class ApiClient extends Context.Service<ApiClient, ApiClientService>()(
  '@little-tables/ApiClient',
) {
  /** The client for the server at `baseUrl` (the page's origin in the app). */
  static readonly layer = (baseUrl: string) => Layer.effect(ApiClient, make(baseUrl))
}

/**
 * The Effect client of `/api/v2`. Every response is decoded with the contract schemas; failures
 * are tagged so callers can tell a refusal (`ApiError`) from a lost connection (`NetworkError`).
 */
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  type HttpClientError,
} from '@effect/platform'
import type { AttemptEvent, LearningPathSettings } from '@little-tables/engine/schema'
import { Context, Data, Effect, Layer, Schema } from 'effect'
import type { ParseError } from 'effect/ParseResult'

import {
  AllowedEmails,
  AuthStatus,
  Bootstrap,
  EmailAdded,
  EmailRemoved,
  IntroductionSeen,
  Logout,
  NotificationConfig,
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
  readonly message: string
  readonly status: number
}> {}

/** The server could not be reached or answered something unreadable. */
export class NetworkError extends Data.TaggedError('NetworkError')<{ readonly cause: unknown }> {}

/** The server answered a body that does not match the contract. */
export class ContractError extends Data.TaggedError('ContractError')<{
  readonly cause: ParseError
}> {}

export type ApiFailure = ApiError | ContractError | NetworkError

const ErrorBody = Schema.Struct({
  error: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
})

export type ProfileChanges = Readonly<{
  avatarId?: SelectableAvatarId
  name?: string
  reminderMinute?: number | null
}>

const make = (baseUrl: string) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient

    const call = <A, I>(
      schema: Schema.Schema<A, I>,
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
          Effect.mapError((cause: HttpClientError.HttpClientError) => new NetworkError({ cause })),
          Effect.flatMap((response): Effect.Effect<A, ApiFailure> =>
            response.status >= 200 && response.status < 300
              ? HttpClientResponse.schemaBodyJson(schema)(response).pipe(
                  Effect.catchTags({
                    ParseError: (cause) => Effect.fail(new ContractError({ cause })),
                    ResponseError: (cause) => Effect.fail(new NetworkError({ cause })),
                  }),
                )
              : HttpClientResponse.schemaBodyJson(ErrorBody)(response).pipe(
                  Effect.orElseSucceed(() => ({ error: undefined, message: undefined })),
                  Effect.flatMap((body) =>
                    Effect.fail(
                      new ApiError({
                        code: body.error ?? 'unknown',
                        message: body.message ?? '',
                        status: response.status,
                      }),
                    ),
                  ),
                ),
          ),
          Effect.scoped,
        )

    const json = (request: HttpClientRequest.HttpClientRequest, body: unknown) =>
      HttpClientRequest.bodyUnsafeJson(request, body)

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
      profiles: () => call(ProfilesResponse, HttpClientRequest.get('/api/v2/family/profiles')),
      refresh: () => call(Refresh, HttpClientRequest.post('/api/v2/auth/refresh')),
      removeEmail: (email: string) =>
        call(
          EmailRemoved,
          HttpClientRequest.del(`/api/v2/admin/allowed-emails/${encodeURIComponent(email)}`),
        ),
      removeProfile: (profileId: string) =>
        call(RemovedProfile, HttpClientRequest.del(familyPath(profileId))),
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
          HttpClientRequest.del(`${profilePath(profileId)}/notifications/subscriptions`).pipe(
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

export type ApiClientService = Effect.Effect.Success<ReturnType<typeof make>>

export class ApiClient extends Context.Tag('@little-tables/ApiClient')<
  ApiClient,
  ApiClientService
>() {
  /** The client for the server at `baseUrl` (the page's origin in the app). */
  static readonly layer = (baseUrl: string) => Layer.effect(ApiClient, make(baseUrl))
}

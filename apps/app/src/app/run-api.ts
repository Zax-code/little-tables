/** One call of the v2 API as a promise that rejects with the tagged failure itself. */
import { ApiClient, type ApiClientService, type ApiFailure } from '@little-tables/api-contract'
import { Effect, Result } from 'effect'

import type { AppRuntime } from '../runtime.js'

// `runPromise` would reject with a wrapper; callers read the failure's tag and code.
export const runApi = <A>(
  runtime: AppRuntime,
  call: (api: ApiClientService) => Effect.Effect<A, ApiFailure>,
): Promise<A> =>
  runtime
    .runPromise(Effect.result(Effect.flatMap(ApiClient, call)))
    .then((result) => (Result.isFailure(result) ? Promise.reject(result.failure) : result.success))

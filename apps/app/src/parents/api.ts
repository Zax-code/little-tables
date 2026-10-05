import { ApiClient, type ApiClientService, type ApiFailure } from '@little-tables/api-contract'
import { Effect } from 'effect'
import { useCallback } from 'react'

import { useApp } from '../app/app-context.js'

/** Runs one call of the v2 API; the promise rejects with the tagged failure. */
export function useApi() {
  const { runtime } = useApp()
  return useCallback(
    <A>(call: (api: ApiClientService) => Effect.Effect<A, ApiFailure>) =>
      runtime.runPromise(Effect.flatMap(ApiClient, call)),
    [runtime],
  )
}

/** The server's error code of a failed call, or `network`. */
export const failureCode = (failure: unknown) =>
  typeof failure === 'object' &&
  failure !== null &&
  'code' in failure &&
  typeof failure.code === 'string'
    ? failure.code
    : 'network'

import type { QueryClient } from '@tanstack/react-query'

import { authStatusQueryKey, fetchAuthStatus } from './auth-client.js'

export function loadAdministratorStatus(queryClient: QueryClient, fetcher: typeof fetch = fetch) {
  return queryClient.fetchQuery({
    queryKey: authStatusQueryKey,
    queryFn: () => fetchAuthStatus(fetcher),
    staleTime: 30_000,
  })
}

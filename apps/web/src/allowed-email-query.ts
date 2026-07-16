import { queryOptions, type QueryClient } from '@tanstack/react-query'

import {
  allowedEmailsQueryKey,
  fetchAllowedEmails,
  type AddAllowedEmailResult,
} from './allowed-email-client.js'

export const allowedEmailsQueryOptions = queryOptions({
  queryKey: allowedEmailsQueryKey,
  queryFn: () => fetchAllowedEmails(),
  staleTime: 30_000,
})

export function prefetchAllowedEmails(queryClient: QueryClient): Promise<void> {
  return queryClient.prefetchQuery(allowedEmailsQueryOptions)
}

export function updateAllowedEmailsCache(
  queryClient: QueryClient,
  result: AddAllowedEmailResult,
): void {
  queryClient.setQueryData<ReadonlyArray<string>>(allowedEmailsQueryKey, (current = []) =>
    [...new Set([...current, result.email])].sort(),
  )
}

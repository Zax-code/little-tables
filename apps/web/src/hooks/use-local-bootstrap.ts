import { useQuery } from '@tanstack/react-query'

import { localBootstrapQueryKey, practiceStoreFor } from '../store.js'
import { useFamilyProfile } from '../use-family-profile.js'

export function useLocalBootstrap() {
  const { activeProfile } = useFamilyProfile()
  return useQuery({
    queryKey: localBootstrapQueryKey(activeProfile.id),
    queryFn: () => practiceStoreFor(activeProfile.id).load(),
    staleTime: Infinity,
  })
}

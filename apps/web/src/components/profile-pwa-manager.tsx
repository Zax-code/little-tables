import { useQueries } from '@tanstack/react-query'

import { localBootstrapQueryKey, practiceStoreFor } from '../store.js'
import { useFamilyProfile } from '../use-family-profile.js'
import { PwaManager } from './pwa-manager.js'

export function ProfilePwaManager() {
  const { profiles } = useFamilyProfile()
  const sessions = useQueries({
    queries: profiles.map(({ id }) => ({
      queryFn: () => practiceStoreFor(id).load(),
      queryKey: localBootstrapQueryKey(id),
    })),
  })
  const practiceActive = sessions.some(
    ({ data }) => data?.activeSession !== null || data.ce2ActiveSession !== null,
  )
  return <PwaManager practiceActive={practiceActive} />
}

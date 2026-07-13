import { useQuery } from '@tanstack/react-query'

import { localBootstrapQueryKey, practiceStore } from '../store.js'

export function useLocalBootstrap() {
  return useQuery({ queryKey: localBootstrapQueryKey, queryFn: () => practiceStore.load() })
}

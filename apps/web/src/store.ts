import { IndexedDbPracticeStore } from '@little-tables/local-store'

export const practiceStore = new IndexedDbPracticeStore('little-tables-v1')
export const localBootstrapQueryKey = ['local-bootstrap'] as const

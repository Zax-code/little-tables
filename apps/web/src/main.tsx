import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'

import { router } from './router.js'
import { SyncManager } from './components/sync-manager.js'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'offlineFirst', retry: 1, staleTime: 30_000 },
    mutations: { networkMode: 'offlineFirst' },
  },
})

const root = document.querySelector('#root')
if (root === null) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <SyncManager />
        <RouterProvider router={router} context={{ queryClient }} />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
)

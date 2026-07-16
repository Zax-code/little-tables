import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'

import { router } from './router.js'
import { AuthGate } from './components/auth-gate.js'
import { SyncManager } from './components/sync-manager.js'
import { decodeStartupImages } from './preload-images.js'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'offlineFirst', retry: 1, staleTime: 30_000 },
    mutations: { networkMode: 'offlineFirst' },
  },
})

const root = document.querySelector('#root')
if (root === null) throw new Error('Missing #root element')

async function enableReactScan() {
  if (!import.meta.env.DEV) return

  const { scan } = await import('react-scan')
  scan({ enabled: true, showFPS: true, showToolbar: true })
}

void Promise.all([decodeStartupImages(), enableReactScan().catch(() => undefined)]).then(() => {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
              <SyncManager />
              <RouterProvider router={router} context={{ queryClient }} />
            </MotionConfig>
          </LazyMotion>
        </AuthGate>
      </QueryClientProvider>
    </StrictMode>,
  )
})

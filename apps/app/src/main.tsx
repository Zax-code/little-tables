import './boot.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { createDevice } from './data/device.js'
import { registerServiceWorker } from './service-worker-client.js'
import { App } from './root.js'
import { createRuntime } from './runtime.js'
import './styles.css'

const runtime = createRuntime()
const device = createDevice()
// The previous app's settings become preferences before the first screen reads them.
device.adoptLegacyKeys()

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { networkMode: 'always' },
    queries: { networkMode: 'always', retry: false },
  },
})

const root = document.querySelector('#root')
if (root === null) throw new Error('Missing #root element')

registerServiceWorker()
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App device={device} runtime={runtime} />
    </QueryClientProvider>
  </StrictMode>,
)

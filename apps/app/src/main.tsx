import { Engine } from '@little-tables/engine'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Effect } from 'effect'
import { MotionConfig } from 'motion/react'
import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'

import {
  OfflineScreen,
  OnboardingScreen,
  OpeningScreen,
  RecoveryScreen,
  SignInScreen,
} from './access/access-screens.js'
import { AppProvider, usePreferenceEffects } from './app/app-context.js'
import { openApp } from './app/family.js'
import { SyncManager } from './app/sync-manager.js'
import { createDevice } from './data/device.js'
import type { Preferences } from './data/schema.js'
import { I18nProvider } from './i18n/i18n.js'
import { registerServiceWorker, reloadWithLatestServiceWorker, shareLanguage } from './pwa.js'
import { router } from './routes.js'
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

/** Opens the app: sign-in, the first child's name, no connection, or the family's space. */
function App() {
  const [preferences, setPreferencesState] = useState(device.preferences)
  const [opening, setOpening] = useState(0)
  usePreferenceEffects(preferences)

  const setPreferences = useCallback((next: Preferences) => {
    device.setPreferences(next)
    setPreferencesState(next)
    shareLanguage(next.language)
  }, [])
  const reopen = useCallback(() => setOpening((current) => current + 1), [])

  const access = useQuery({
    // The engine is loaded first: screens derive their values from it synchronously.
    queryFn: () => runtime.runPromise(Effect.zipRight(Engine, openApp(device))),
    queryKey: ['open', opening],
    staleTime: Number.POSITIVE_INFINITY,
  })

  let screen
  if (access.isPending) screen = <OpeningScreen />
  else if (access.isError)
    screen = <RecoveryScreen onRecover={() => void reloadWithLatestServiceWorker()} />
  else {
    const opened = access.data
    switch (opened.kind) {
      case 'signed-out':
        screen = (
          <SignInScreen
            googleClientId={opened.googleClientId}
            onSignedIn={reopen}
            runtime={runtime}
          />
        )
        break
      case 'offline':
        screen = <OfflineScreen onRetry={reopen} />
        break
      case 'onboarding':
        screen = <OnboardingScreen onDone={reopen} runtime={runtime} />
        break
      case 'ready':
        screen = (
          <AppProvider
            device={device}
            family={opened.family}
            key={opening}
            preferences={preferences}
            reopen={reopen}
            runtime={runtime}
            setPreferences={setPreferences}
          >
            <SyncManager>
              <RouterProvider router={router} />
            </SyncManager>
          </AppProvider>
        )
    }
  }

  return (
    <I18nProvider language={preferences.language}>
      <MotionConfig reducedMotion="user">{screen}</MotionConfig>
    </I18nProvider>
  )
}

const root = document.querySelector('#root')
if (root === null) throw new Error('Missing #root element')

registerServiceWorker()
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

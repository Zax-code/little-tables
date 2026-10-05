/** The app's root: what opens, and the family's space once it is open. */
import { Engine } from '@little-tables/engine'
import { useQuery } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Effect } from 'effect'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import { useCallback, useState } from 'react'

import {
  OfflineScreen,
  OnboardingScreen,
  OpeningScreen,
  RecoveryScreen,
  SignInScreen,
} from './access/access-screens.js'
import { AppProvider } from './app/app-context.js'
import { usePreferenceEffects } from './app/preference-effects.js'
import { openApp } from './app/family.js'
import { SyncManager } from './app/sync-manager.js'
import type { Device } from './data/device.js'
import type { Preferences } from './data/schema.js'
import { I18nProvider } from './i18n/i18n.js'
import { reloadWithLatestServiceWorker, shareLanguage } from './service-worker-client.js'
import { router } from './routes.js'
import type { AppRuntime } from './runtime.js'

/** Opens the app: sign-in, the first child's name, no connection, or the family's space. */
export function App({ device, runtime }: Readonly<{ device: Device; runtime: AppRuntime }>) {
  const [preferences, setPreferencesState] = useState(() => device.preferences())
  const [opening, setOpening] = useState(0)
  usePreferenceEffects(preferences)

  const setPreferences = useCallback(
    (next: Preferences) => {
      device.setPreferences(next)
      setPreferencesState(next)
      shareLanguage(next.language)
    },
    [device],
  )
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
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">{screen}</MotionConfig>
      </LazyMotion>
    </I18nProvider>
  )
}

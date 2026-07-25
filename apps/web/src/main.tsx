import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'

import { router } from './router.js'
import { AuthGate } from './components/auth-gate.js'
import { PwaManager } from './components/pwa-manager.js'
import { SyncManager } from './components/sync-manager.js'
import { I18nProvider } from './i18n.js'
import { decodeStartupImages } from './preload-images.js'
import { FamilyProfileProvider } from './family-profile-provider.js'
import { SelectedCharacterProvider } from './selected-character-provider.js'
import { useSelectedCharacter } from './use-selected-character.js'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'offlineFirst', retry: 1, staleTime: 30_000 },
    mutations: { networkMode: 'offlineFirst' },
  },
})

function requireRoot(): Element {
  const element = document.querySelector('#root')
  if (element === null) throw new Error('Missing #root element')
  return element
}

const root = requireRoot()

async function enableReactScan() {
  if (!import.meta.env.DEV) return

  const { scan } = await import('react-scan')
  scan({ enabled: true, showFPS: true, showToolbar: true })
}

function ProfileRouter() {
  const character = useSelectedCharacter()
  const previousCharacterId = useRef(character.id)

  useEffect(() => {
    if (previousCharacterId.current === character.id) return
    previousCharacterId.current = character.id
    void router.invalidate()
  }, [character.id])

  return <RouterProvider router={router} context={{ character, queryClient }} />
}

async function renderCharacterAudit(): Promise<boolean> {
  if (!import.meta.env.DEV || window.location.pathname !== '/__character-audit') {
    return false
  }
  const { CharacterAudit } = await import('./components/character-audit.js')
  createRoot(root).render(
    <StrictMode>
      <I18nProvider>
        <LazyMotion features={domAnimation} strict>
          <MotionConfig reducedMotion="user">
            <CharacterAudit />
          </MotionConfig>
        </LazyMotion>
      </I18nProvider>
    </StrictMode>,
  )
  return true
}

void renderCharacterAudit().then((auditRendered) => {
  if (auditRendered) return
  return Promise.all([decodeStartupImages(), enableReactScan().catch(() => undefined)]).then(() => {
    createRoot(root).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <PwaManager />
            <AuthGate>
              <FamilyProfileProvider>
                <SelectedCharacterProvider>
                  <LazyMotion features={domAnimation} strict>
                    <MotionConfig reducedMotion="user">
                      <SyncManager />
                      <ProfileRouter />
                    </MotionConfig>
                  </LazyMotion>
                </SelectedCharacterProvider>
              </FamilyProfileProvider>
            </AuthGate>
          </I18nProvider>
        </QueryClientProvider>
      </StrictMode>,
    )
  })
})

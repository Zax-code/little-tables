/** The app's screens (`docs/rewrite/TECHNICAL_SPEC.md` §6.2). */
import { Toaster } from '@little-tables/ui'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router'

import { useApp } from './app/app-context.js'
import { RecoveryScreen } from './access/access-screens.js'
import { TodayScreen } from './child/today-screen.js'
import { GardenScreen } from './garden/garden-screen.js'
import { HerbariumScreen } from './garden/herbarium-screen.js'
import { ChildScreen, NewChildScreen, SchoolScreen } from './parents/child-screens.js'
import { AccessScreen, ParentsHomeScreen, SettingsScreen } from './parents/parents-home.js'
import { PathsScreen, ProgressScreen, TableScreen } from './progress/progress-screens.js'
import { reloadWithLatestServiceWorker, UpdateBanner } from './pwa.js'
import { CelebrationScreen } from './reward/celebration-screen.js'
import { SessionScreen } from './session/session-screen.js'

function Root() {
  return (
    <>
      <Outlet />
      <UpdateBanner />
      <Toaster position="top-center" />
    </>
  )
}

/** Only administrators see who can sign in. */
function AdminOnly() {
  const { family } = useApp()
  return family.isAdmin ? <AccessScreen /> : <Navigate replace to="/parents" />
}

const root = createRootRoute({
  component: Root,
  errorComponent: () => <RecoveryScreen onRecover={() => void reloadWithLatestServiceWorker()} />,
  notFoundComponent: () => <Navigate replace to="/" />,
})

const route = <Path extends string>(path: Path, component: () => React.ReactNode) =>
  createRoute({ component, getParentRoute: () => root, path })

const routeTree = root.addChildren([
  route('/', TodayScreen),
  route('/garden', GardenScreen),
  route('/garden/herbarium', HerbariumScreen),
  route('/progress', ProgressScreen),
  route('/progress/tables/$table', TableScreen),
  route('/progress/paths', PathsScreen),
  route('/session', SessionScreen),
  route('/celebration', CelebrationScreen),
  route('/parents', ParentsHomeScreen),
  route('/parents/settings', SettingsScreen),
  route('/parents/access', AdminOnly),
  route('/parents/new-child', NewChildScreen),
  route('/parents/children/$profileId', ChildScreen),
  route('/parents/children/$profileId/school', SchoolScreen),
])

export const router = createRouter({ defaultPreload: 'intent', routeTree, scrollRestoration: true })

declare module '@tanstack/react-router' {
  // Module augmentation needs an interface.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Register {
    router: typeof router
  }
}

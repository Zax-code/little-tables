/** The app's screens (`docs/rewrite/TECHNICAL_SPEC.md` §6.2). */
import { Toaster } from '@little-tables/ui'
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
  Outlet,
  type RouteComponent,
} from '@tanstack/react-router'

import { useApp } from './app/app-context.js'
import { RecoveryScreen } from './access/access-screens.js'
import { TodayScreen } from './child/today-screen.js'
import { UpdateBanner } from './pwa.js'
import { reloadWithLatestServiceWorker } from './service-worker-client.js'

function Root() {
  return (
    <>
      <Outlet />
      <UpdateBanner />
      <Toaster position="top-center" />
    </>
  )
}

// Today opens with the app; every other screen is loaded on first visit.
const GardenScreen = lazyRouteComponent(() => import('./garden/garden-screen.js'), 'GardenScreen')
const HerbariumScreen = lazyRouteComponent(
  () => import('./garden/herbarium-screen.js'),
  'HerbariumScreen',
)
const ProgressScreen = lazyRouteComponent(
  () => import('./progress/progress-screen.js'),
  'ProgressScreen',
)
const TableScreen = lazyRouteComponent(() => import('./progress/table-screen.js'), 'TableScreen')
const PathsScreen = lazyRouteComponent(() => import('./progress/paths-screen.js'), 'PathsScreen')
const SessionScreen = lazyRouteComponent(
  () => import('./session/session-screen.js'),
  'SessionScreen',
)
const CelebrationScreen = lazyRouteComponent(
  () => import('./reward/celebration-screen.js'),
  'CelebrationScreen',
)
const ParentsHomeScreen = lazyRouteComponent(
  () => import('./parents/parents-home.js'),
  'ParentsHomeScreen',
)
const SettingsScreen = lazyRouteComponent(
  () => import('./parents/parents-home.js'),
  'SettingsScreen',
)
const AccessScreen = lazyRouteComponent(() => import('./parents/parents-home.js'), 'AccessScreen')
const NewChildScreen = lazyRouteComponent(
  () => import('./parents/child-screens.js'),
  'NewChildScreen',
)
const ChildScreen = lazyRouteComponent(() => import('./parents/child-screens.js'), 'ChildScreen')
const SchoolScreen = lazyRouteComponent(() => import('./parents/child-screens.js'), 'SchoolScreen')

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

const route = <Path extends string>(path: Path, component: RouteComponent) =>
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

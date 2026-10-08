/** The app's screens (`docs/rewrite/TECHNICAL_SPEC.md` §6.2). */
import { Toaster } from '@little-tables/ui'
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
  Outlet,
  useRouterState,
  type RouteComponent,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import { useApp } from './app/app-context.js'
import { RecoveryScreen } from './access/access-screens.js'
import { TodayScreen } from './child/today-screen.js'
import { parentSpace } from './parents/parent-code.js'
import { ParentGate } from './parents/parent-gate.js'
import { UpdateBanner } from './pwa.js'
import { reloadWithLatestServiceWorker } from './service-worker-client.js'

function Root() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // Back in the child space, the parent space asks for the code again.
  useEffect(() => {
    if (!pathname.startsWith('/parents')) parentSpace.close()
  }, [pathname])
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
const MeadowScreen = lazyRouteComponent(() => import('./meadow/meadow-screen.js'), 'MeadowScreen')
const ProgressScreen = lazyRouteComponent(
  () => import('./progress/progress-screen.js'),
  'ProgressScreen',
)
const TableScreen = lazyRouteComponent(() => import('./progress/table-screen.js'), 'TableScreen')
const PathsScreen = lazyRouteComponent(() => import('./progress/paths-screen.js'), 'PathsScreen')
const VerbsScreen = lazyRouteComponent(() => import('./progress/verbs-screen.js'), 'VerbsScreen')
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
const VerbCatalogueScreen = lazyRouteComponent(
  () => import('./parents/verbs-screen.js'),
  'VerbCatalogueScreen',
)
const InsightsScreen = lazyRouteComponent(
  () => import('./parents/insights-screen.js'),
  'InsightsScreen',
)

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

/** Every parent screen sits behind the parent code. */
const parents = createRoute({
  component: () => (
    <ParentGate>
      <Outlet />
    </ParentGate>
  ),
  getParentRoute: () => root,
  id: 'parents',
})
const parentRoute = <Path extends string>(path: Path, component: RouteComponent) =>
  createRoute({ component, getParentRoute: () => parents, path })

const routeTree = root.addChildren([
  route('/', TodayScreen),
  route('/garden', GardenScreen),
  route('/garden/herbarium', HerbariumScreen),
  route('/garden/meadow', MeadowScreen),
  route('/progress', ProgressScreen),
  route('/progress/tables/$table', TableScreen),
  route('/progress/paths', PathsScreen),
  route('/progress/verbs', VerbsScreen),
  route('/session', SessionScreen),
  route('/celebration', CelebrationScreen),
  parents.addChildren([
    parentRoute('/parents', ParentsHomeScreen),
    parentRoute('/parents/settings', SettingsScreen),
    parentRoute('/parents/access', AdminOnly),
    parentRoute('/parents/new-child', NewChildScreen),
    parentRoute('/parents/children/$profileId', ChildScreen),
    parentRoute('/parents/children/$profileId/school', SchoolScreen),
    parentRoute('/parents/children/$profileId/verbs', VerbCatalogueScreen),
    parentRoute('/parents/children/$profileId/insights', InsightsScreen),
  ]),
])

/**
 * A router for each mount of the family's space: a navigation left pending when the space closes
 * (the app reopening, a test ending) must not hold the next one.
 */
export const createAppRouter = () =>
  createRouter({ defaultPreload: 'intent', routeTree, scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

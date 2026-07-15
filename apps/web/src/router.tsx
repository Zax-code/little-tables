import type { QueryClient } from '@tanstack/react-query'
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import { PwaManager } from './components/pwa-manager.js'
import { fetchAuthStatus } from './auth-client.js'

const AccessScreen = lazy(() =>
  import('./screens/access-screen.js').then((module) => ({ default: module.AccessScreen })),
)

const CelebrationScreen = lazy(() =>
  import('./screens/celebration-screen.js').then((module) => ({
    default: module.CelebrationScreen,
  })),
)
const GardenScreen = lazy(() =>
  import('./screens/garden-screen.js').then((module) => ({ default: module.GardenScreen })),
)
const HomeScreen = lazy(() =>
  import('./screens/home-screen.js').then((module) => ({ default: module.HomeScreen })),
)
const PracticeScreen = lazy(() =>
  import('./screens/practice-screen.js').then((module) => ({ default: module.PracticeScreen })),
)
const StatsScreen = lazy(() =>
  import('./screens/stats-screen.js').then((module) => ({ default: module.StatsScreen })),
)

type RouterContext = Readonly<{ queryClient: QueryClient | undefined }>

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Suspense fallback={<div className="loading-state">opening your garden…</div>}>
        <Outlet />
      </Suspense>
      <PwaManager />
    </>
  ),
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeScreen,
})
const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice',
  component: PracticeScreen,
})
const celebrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/celebration',
  component: CelebrationScreen,
})
const gardenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/garden',
  component: GardenScreen,
})
const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  component: StatsScreen,
})
const accessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/access',
  beforeLoad: async () => {
    try {
      const auth = await fetchAuthStatus()
      if (auth.isAdmin) return
    } catch {
      // Management requires a fresh server-confirmed owner session.
    }
    return redirect({ throw: true, to: '/' })
  },
  component: AccessScreen,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  practiceRoute,
  celebrationRoute,
  gardenRoute,
  statsRoute,
  accessRoute,
])

export const router = createRouter({ routeTree, context: { queryClient: undefined } })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

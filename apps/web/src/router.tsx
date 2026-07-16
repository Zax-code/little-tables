import type { QueryClient } from '@tanstack/react-query'
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  useLocation,
} from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import { PwaManager } from './components/pwa-manager.js'
import { Screen } from './components/screen.js'
import { FlowerTransitionProvider } from './components/flower-transition.js'
import { loadAdministratorStatus } from './admin-access.js'
import { prefetchAllowedEmails } from './allowed-email-query.js'
import {
  celebrationSprite,
  characterAssets,
  gardenWalkingSprite,
  gardenWateringSprite,
} from './assets.js'
import { decodeRouteImages } from './preload-images.js'
import { useI18n } from './i18n.js'

const AccessScreen = lazyRouteComponent(() => import('./screens/access-screen.js'), 'AccessScreen')
const DevelopmentTools = import.meta.env.DEV
  ? lazy(() =>
      import('./components/development-tools.js').then((module) => ({
        default: module.DevelopmentTools,
      })),
    )
  : null

const CelebrationScreen = lazyRouteComponent(
  () => import('./screens/celebration-screen.js'),
  'CelebrationScreen',
)
const GardenScreen = lazyRouteComponent(() => import('./screens/garden-screen.js'), 'GardenScreen')
const HomeScreen = lazyRouteComponent(() => import('./screens/home-screen.js'), 'HomeScreen')
const PracticeScreen = lazyRouteComponent(
  () => import('./screens/practice-screen.js'),
  'PracticeScreen',
)
const StatsScreen = lazyRouteComponent(() => import('./screens/stats-screen.js'), 'StatsScreen')

type RouterContext = Readonly<{ queryClient: QueryClient | undefined }>

function TabsLayout() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const { t } = useI18n()

  return (
    <Screen {...(pathname === '/garden' ? { contentClassName: 'screen-content-garden' } : {})}>
      <Suspense fallback={<div className="loading-state">{t('app.openingGarden')}</div>}>
        <Outlet />
      </Suspense>
    </Screen>
  )
}

function RootLayout() {
  const { t } = useI18n()
  return (
    <FlowerTransitionProvider>
      <Suspense fallback={<div className="loading-state">{t('app.openingGarden')}</div>}>
        <Outlet />
      </Suspense>
      <PwaManager />
      {DevelopmentTools === null ? null : (
        <Suspense fallback={null}>
          <DevelopmentTools />
        </Suspense>
      )}
    </FlowerTransitionProvider>
  )
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

const tabsRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'tabs',
  component: TabsLayout,
})

const homeRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/',
  component: HomeScreen,
})
const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/practice',
  loader: () =>
    decodeRouteImages('practice', [
      characterAssets.practice.src,
      characterAssets.practiceCorrect.src,
      characterAssets.practiceEncourage.src,
    ]),
  component: PracticeScreen,
})
const celebrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/celebration',
  loader: () => decodeRouteImages('celebration', [celebrationSprite.src]),
  component: CelebrationScreen,
})
const gardenRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/garden',
  loader: () => decodeRouteImages('garden', [gardenWalkingSprite.src, gardenWateringSprite.src]),
  component: GardenScreen,
})
const statsRoute = createRoute({
  getParentRoute: () => tabsRoute,
  path: '/stats',
  component: StatsScreen,
})
const accessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/access',
  beforeLoad: async ({ context }) => {
    if (context.queryClient === undefined) return redirect({ throw: true, to: '/' })
    try {
      const auth = await loadAdministratorStatus(context.queryClient)
      if (auth.isAdmin) return
    } catch {
      // Management requires a fresh server-confirmed owner session.
    }
    return redirect({ throw: true, to: '/' })
  },
  loader: ({ context }) => {
    if (context.queryClient === undefined) throw new Error('Missing router query client')
    return prefetchAllowedEmails(context.queryClient)
  },
  component: AccessScreen,
})

const routeTree = rootRoute.addChildren([
  tabsRoute.addChildren([homeRoute, gardenRoute, statsRoute]),
  practiceRoute,
  celebrationRoute,
  accessRoute,
])

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined },
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

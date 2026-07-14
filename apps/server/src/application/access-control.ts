type NavigationRedirectInput = Readonly<{
  authenticated: boolean
  authenticationRequired: boolean
  isNavigation: boolean
  pathname: string
}>

const navigationRedirect = ({
  authenticated,
  authenticationRequired,
  isNavigation,
  pathname,
}: NavigationRedirectInput): '/' | '/sign-in' | null => {
  if (!authenticationRequired || !isNavigation) return null
  if (!authenticated && pathname !== '/sign-in') return '/sign-in'
  if (authenticated && pathname === '/sign-in') return '/'
  return null
}

export const AccessControl = { navigationRedirect } as const

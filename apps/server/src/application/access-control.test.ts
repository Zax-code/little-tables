import { describe, expect, it } from 'vitest'

import { AccessControl } from './access-control.js'

describe('AccessControl.navigationRedirect', () => {
  it('redirects every unauthenticated navigation to sign-in', () => {
    for (const pathname of ['/', '/garden', '/practice']) {
      expect(
        AccessControl.navigationRedirect({
          authenticated: false,
          authenticationRequired: true,
          isNavigation: true,
          pathname,
        }),
      ).toBe('/sign-in')
    }
  })

  it('allows the sign-in shell and public static assets', () => {
    expect(
      AccessControl.navigationRedirect({
        authenticated: false,
        authenticationRequired: true,
        isNavigation: true,
        pathname: '/sign-in',
      }),
    ).toBeNull()
    expect(
      AccessControl.navigationRedirect({
        authenticated: false,
        authenticationRequired: true,
        isNavigation: false,
        pathname: '/assets/app.js',
      }),
    ).toBeNull()
  })

  it('redirects an authenticated user away from the sign-in page', () => {
    expect(
      AccessControl.navigationRedirect({
        authenticated: true,
        authenticationRequired: true,
        isNavigation: true,
        pathname: '/sign-in',
      }),
    ).toBe('/')
  })
})

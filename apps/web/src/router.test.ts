import { describe, expect, it } from 'vitest'

import { router } from './router.js'

describe('tab routing', () => {
  it('preloads route modules and keeps tab screens under one persistent layout', () => {
    expect(router.options.defaultPreload).toBe('intent')
    expect(router.routesByPath['/'].parentRoute).toBe(router.routesById['/tabs'])
    expect(router.routesByPath['/garden'].parentRoute).toBe(router.routesById['/tabs'])
    expect(router.routesByPath['/garden/collection'].parentRoute).toBe(router.routesById['/tabs'])
    expect(router.routesByPath['/stats'].parentRoute).toBe(router.routesById['/tabs'])
  })

  it('loads the allowlist before committing the administrator screen', () => {
    expect(router.routesByPath['/access'].options.loader).toEqual(expect.any(Function))
  })

  it('keeps family management outside the member practice tab layout', () => {
    expect(router.routesByPath['/family'].parentRoute).toBe(router.routesById.__root__)
  })
})

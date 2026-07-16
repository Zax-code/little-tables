import { describe, expect, it } from 'vitest'

import { router } from './router.js'

describe('tab routing', () => {
  it('preloads route modules and keeps tab screens under one persistent layout', () => {
    expect(router.options.defaultPreload).toBe('intent')
    expect(router.routesByPath['/'].parentRoute).toBe(router.routesById['/tabs'])
    expect(router.routesByPath['/garden'].parentRoute).toBe(router.routesById['/tabs'])
    expect(router.routesByPath['/stats'].parentRoute).toBe(router.routesById['/tabs'])
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    preload,
    to,
  }: Readonly<{ children: string; preload: string; to: string }>) => (
    <a data-preload={preload} data-router-link href={to}>
      {children}
    </a>
  ),
}))

import { OwnerAccessLink } from './owner-access-link.js'

describe('OwnerAccessLink', () => {
  it('renders access management only for the owner', () => {
    expect(renderToStaticMarkup(<OwnerAccessLink isAdmin={false} />)).toBe('')
    const ownerMarkup = renderToStaticMarkup(<OwnerAccessLink isAdmin />)

    expect(ownerMarkup).toContain('gérer les accès au jardin')
    expect(ownerMarkup).toContain('data-router-link="true"')
    expect(ownerMarkup).toContain('data-preload="render"')
  })
})

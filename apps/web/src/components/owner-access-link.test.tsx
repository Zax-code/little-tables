import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OwnerAccessLink } from './owner-access-link.js'

describe('OwnerAccessLink', () => {
  it('renders access management only for the owner', () => {
    expect(renderToStaticMarkup(<OwnerAccessLink isAdmin={false} />)).toBe('')
    expect(renderToStaticMarkup(<OwnerAccessLink isAdmin />)).toContain('manage who can join')
  })
})

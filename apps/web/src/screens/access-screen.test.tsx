import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { allowedEmailsQueryKey } from '../allowed-email-client.js'

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

vi.mock('../components/screen.js', () => ({
  Screen: ({ children }: PropsWithChildren) => <main>{children}</main>,
}))

import { AccessScreen } from './access-screen.js'

describe('access screen', () => {
  it('returns to the garden without reloading the app', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(allowedEmailsQueryKey, ['boomslang.a@gmail.com'])

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <AccessScreen />
      </QueryClientProvider>,
    )

    expect(markup).toContain('← back to the garden')
    expect(markup).toContain('data-router-link="true"')
    expect(markup).toContain('data-preload="render"')
  })

  it('offers removal for learners while protecting the owner address', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(allowedEmailsQueryKey, [
      'boomslang.a@gmail.com',
      'learner@example.com',
    ])

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <AccessScreen />
      </QueryClientProvider>,
    )

    expect(markup).toContain('Remove learner@example.com from the allowlist')
    expect(markup).not.toContain('Remove boomslang.a@gmail.com from the allowlist')
  })
})

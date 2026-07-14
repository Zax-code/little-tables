import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEffect, useRef, useState } from 'react'

import {
  authStatusQueryKey,
  claimInvite,
  fetchAuthStatus,
  signInWithGoogle,
} from '../auth-client.js'
import { renderGoogleSignInButton } from '../google-identity.js'
import { Bunny } from './bunny.js'
import { Screen } from './screen.js'

function GoogleSignInButton({ clientId }: Readonly<{ clientId: string }>) {
  const button = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const element = button.current
    if (element === null) return
    let active = true
    void renderGoogleSignInButton({
      clientId,
      element,
      onCredential: (credential) => {
        if (!active) return
        setError(undefined)
        setPending(true)
        void signInWithGoogle(credential)
          .then(() => queryClient.invalidateQueries({ queryKey: authStatusQueryKey }))
          .catch((cause: unknown) => {
            setError(
              cause instanceof Error ? cause.message : 'Google sign-in could not be completed.',
            )
          })
          .finally(() => setPending(false))
      },
    }).catch((cause: unknown) => {
      if (active) {
        setError(
          cause instanceof Error ? cause.message : 'The Google sign-in button could not be loaded.',
        )
      }
    })
    return () => {
      active = false
      element.replaceChildren()
    }
  }, [clientId, queryClient])

  return (
    <div className="google-sign-in-area">
      <div
        aria-label="Sign in with Google"
        className={pending ? 'google-button pending' : 'google-button'}
        ref={button}
      />
      {pending ? <p role="status">opening your garden…</p> : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function AuthGate({ children }: PropsWithChildren) {
  const [inviteError, setInviteError] = useState<string>()
  const auth = useQuery({
    queryKey: authStatusQueryKey,
    queryFn: async () => {
      const url = new URL(window.location.href)
      const invite = url.searchParams.get('invite')
      if (invite !== null) {
        try {
          await claimInvite(invite)
          url.searchParams.delete('invite')
          window.history.replaceState(null, '', url)
          setInviteError(undefined)
        } catch (cause) {
          setInviteError(
            cause instanceof Error ? cause.message : 'The private invite could not be claimed.',
          )
        }
      }
      return fetchAuthStatus()
    },
    retry: 1,
    staleTime: 30_000,
  })

  if (auth.isPending) return <div className="app-loading">opening your garden…</div>
  if (auth.isError || auth.data.authenticated || !auth.data.authenticationRequired) {
    return children
  }

  return (
    <Screen footer={false}>
      <section className="auth-screen">
        <div>
          <p className="eyebrow">little tables.</p>
          <h1>your garden is waiting ♡</h1>
          <p>Sign in to safely bring your progress with you.</p>
        </div>
        <Bunny className="auth-bunny" scene="home" />
        {auth.data.googleClientId === null ? (
          <p className="auth-help">Open your private invite link to continue.</p>
        ) : (
          <GoogleSignInButton clientId={auth.data.googleClientId} />
        )}
        {inviteError ? (
          <p className="auth-error" role="alert">
            {inviteError}
          </p>
        ) : null}
      </section>
    </Screen>
  )
}

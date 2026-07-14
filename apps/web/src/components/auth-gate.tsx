import { useQuery } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEffect, useRef, useState } from 'react'

import { authStatusQueryKey, fetchAuthStatus, signInWithGoogle } from '../auth-client.js'
import { renderGoogleSignInButton } from '../google-identity.js'
import {
  authStatusFromOfflineGrant,
  clearOfflineAuthGrant,
  offlineGrantFromAuthStatus,
  persistOfflineAuthGrant,
  readOfflineAuthGrant,
} from '../offline-auth.js'
import { Bunny } from './bunny.js'
import { Screen } from './screen.js'

function GoogleSignInButton({ clientId }: Readonly<{ clientId: string }>) {
  const button = useRef<HTMLDivElement>(null)
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
          .then(() => window.location.replace('/'))
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
  }, [clientId])

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
  const [offlineGrant, setOfflineGrant] = useState(() => readOfflineAuthGrant())
  const auth = useQuery({
    initialData: offlineGrant === null ? undefined : authStatusFromOfflineGrant(offlineGrant),
    initialDataUpdatedAt: 0,
    queryKey: authStatusQueryKey,
    queryFn: async () => {
      const status = await fetchAuthStatus()
      persistOfflineAuthGrant(status)
      return status
    },
    retry: 1,
    staleTime: 30_000,
  })
  const serverGrant = auth.data ? offlineGrantFromAuthStatus(auth.data) : null
  const serverSaysSignedOut = auth.data?.authenticationRequired === true && !auth.data.authenticated
  const accessGrant = serverSaysSignedOut ? null : (serverGrant ?? offlineGrant)
  const accessGrantExpiresAt = accessGrant?.expiresAt
  const canAccess = auth.data?.authenticationRequired === false || accessGrant !== null
  const mustSignIn = !canAccess && !auth.isPending

  useEffect(() => {
    if (accessGrantExpiresAt === undefined) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    const expireWhenDue = () => {
      const remaining = accessGrantExpiresAt - Date.now()
      if (remaining > 0) {
        timeout = setTimeout(expireWhenDue, Math.min(remaining, 2_147_483_647))
        return
      }
      clearOfflineAuthGrant()
      setOfflineGrant(null)
    }
    expireWhenDue()
    return () => {
      if (timeout !== undefined) clearTimeout(timeout)
    }
  }, [accessGrantExpiresAt])

  useEffect(() => {
    if (mustSignIn && window.location.pathname !== '/sign-in') {
      window.history.replaceState(null, '', '/sign-in')
    }
  }, [mustSignIn])

  if (canAccess) return children
  if (auth.isPending) return <div className="app-loading">opening your garden…</div>
  if (auth.isError) {
    return (
      <Screen footer={false}>
        <section className="auth-screen">
          <div>
            <p className="eyebrow">little tables.</p>
            <h1>sign-in is required</h1>
            <p>Connect to the internet so we can safely check your account.</p>
          </div>
          <Bunny className="auth-bunny" scene="home" />
          <button className="primary-button auth-retry" onClick={() => void auth.refetch()}>
            try again
          </button>
        </section>
      </Screen>
    )
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
        {auth.data?.googleClientId === null || auth.data?.googleClientId === undefined ? (
          <p className="auth-error" role="alert">
            Google sign-in is temporarily unavailable.
          </p>
        ) : (
          <GoogleSignInButton clientId={auth.data.googleClientId} />
        )}
      </section>
    </Screen>
  )
}

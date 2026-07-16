import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PropsWithChildren, SyntheticEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { googleConnectIcon } from '../assets.js'
import {
  authStatusQueryKey,
  fetchAuthStatus,
  GoogleSignInError,
  savePreferredName,
  signInWithGoogle,
} from '../auth-client.js'
import { renderGoogleSignInButton } from '../google-identity.js'
import { useI18n } from '../i18n.js'
import {
  authStatusFromOfflineGrant,
  clearOfflineAuthGrant,
  offlineGrantFromAuthStatus,
  persistOfflineAuthGrant,
  readOfflineAuthGrant,
} from '../offline-auth.js'
import { Bunny } from './bunny.js'
import { Screen } from './screen.js'

export function GoogleConnectButtonArtwork() {
  const { t } = useI18n()
  return (
    <span aria-hidden="true" className="google-button-artwork">
      <img alt="" src={googleConnectIcon.src} />
      <span>{t('auth.connectGoogle')}</span>
    </span>
  )
}

export function PreferredNameForm({
  defaultName,
  onSave,
}: Readonly<{
  defaultName: string
  onSave: (displayName: string) => Promise<void>
}>) {
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState(defaultName)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || displayName.trim() === '') return
    setError(undefined)
    setPending(true)
    void onSave(displayName)
      .catch(() => setError(t('auth.nameChoiceSaveFailed')))
      .finally(() => setPending(false))
  }

  return (
    <>
      <div>
        <p className="eyebrow">little tables.</p>
        <h1>{t('auth.nameChoiceTitle')}</h1>
        <p>{t('auth.nameChoiceCopy')}</p>
      </div>
      <Bunny className="auth-bunny" scene="home" />
      <form className="name-choice-form" onSubmit={submit}>
        <label htmlFor="preferred-name">{t('auth.nameChoiceLabel')}</label>
        <input
          autoComplete="nickname"
          id="preferred-name"
          maxLength={40}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={defaultName}
          required
          value={displayName}
        />
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? t('auth.nameChoiceSaving') : t('auth.nameChoiceSave')}
        </button>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </>
  )
}

function GoogleSignInButton({ clientId }: Readonly<{ clientId: string }>) {
  const { locale, t } = useI18n()
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
      locale,
      onCredential: (credential) => {
        if (!active) return
        setError(undefined)
        setPending(true)
        void signInWithGoogle(credential)
          .then(() => window.location.replace('/'))
          .catch((cause: unknown) => {
            setError(
              cause instanceof GoogleSignInError && cause.reason === 'unauthorized'
                ? t('auth.unauthorized')
                : t('auth.signInFailed'),
            )
          })
          .finally(() => setPending(false))
      },
    }).catch((_cause: unknown) => {
      if (active) {
        setError(t('auth.buttonLoadFailed'))
      }
    })
    return () => {
      active = false
      element.replaceChildren()
    }
  }, [clientId, locale, t])

  return (
    <div className="google-sign-in-area">
      <div className={pending ? 'google-button pending' : 'google-button'}>
        <GoogleConnectButtonArtwork />
        <div className="google-button-provider" ref={button} />
      </div>
      {pending ? <p role="status">{t('auth.opening')}</p> : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function AuthGate({ children }: PropsWithChildren) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
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
    refetchInterval: 30_000,
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

  const nameChoiceStatus =
    canAccess && auth.data?.nameChoiceRequired === true && typeof auth.data.displayName === 'string'
      ? { ...auth.data, displayName: auth.data.displayName }
      : null
  if (nameChoiceStatus !== null) {
    return (
      <Screen footer={false}>
        <section className="auth-screen name-choice-screen">
          <PreferredNameForm
            defaultName={nameChoiceStatus.displayName}
            onSave={async (displayName) => {
              const savedDisplayName = await savePreferredName(displayName)
              const status = {
                ...nameChoiceStatus,
                displayName: savedDisplayName,
                nameChoiceRequired: false,
              }
              persistOfflineAuthGrant(status)
              queryClient.setQueryData(authStatusQueryKey, status)
            }}
          />
        </section>
      </Screen>
    )
  }
  if (canAccess) return children
  if (auth.isPending) return <div className="app-loading">{t('app.openingGarden')}</div>
  if (auth.isError) {
    return (
      <Screen footer={false}>
        <section className="auth-screen">
          <div>
            <p className="eyebrow">little tables.</p>
            <h1>{t('auth.required')}</h1>
            <p>{t('auth.internetRequired')}</p>
          </div>
          <Bunny className="auth-bunny" scene="home" />
          <button
            className="primary-button auth-retry"
            onClick={() => void auth.refetch()}
            type="button"
          >
            {t('auth.retry')}
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
          <h1>{t('auth.waitingTitle')}</h1>
          <p>{t('auth.waitingCopy')}</p>
        </div>
        <Bunny className="auth-bunny" scene="home" />
        {auth.data?.googleClientId === null || auth.data?.googleClientId === undefined ? (
          <p className="auth-error" role="alert">
            {t('auth.signInUnavailable')}
          </p>
        ) : (
          <GoogleSignInButton clientId={auth.data.googleClientId} />
        )}
      </section>
    </Screen>
  )
}

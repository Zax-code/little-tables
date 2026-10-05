/**
 * Screens shown before a family is open (mockups B1 to B4): sign-in, the first child's name, no
 * connection at the first opening, and recovery after an error.
 */
import { Button, Screen, TextField } from '@little-tables/ui'
import { RefreshCw, RotateCcw, Sprout } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'

import { runApi } from '../app/run-api.js'
import { CharacterImage } from '../characters/character-image.js'
import type { SceneId } from '../characters/characters.js'
import { useI18n } from '../i18n/i18n.js'
import type { AppRuntime } from '../runtime.js'
import { renderGoogleSignInButton } from './google-identity.js'

type AccessLayoutProps = Readonly<{
  bottom?: ReactNode
  children?: ReactNode
  copy: string
  eyebrow?: string
  scene: SceneId
  title: string
}>

function AccessLayout({ bottom, children, copy, eyebrow, scene, title }: AccessLayoutProps) {
  const { t } = useI18n()
  return (
    <Screen bottom={bottom}>
      <div className="m-auto flex w-full max-w-sm flex-col items-center gap-3 py-8 text-center">
        <CharacterImage
          alt={t('character.alt', { character: 'Miffy' })}
          character="miffy"
          className="mb-4 h-44 w-auto"
          eager
          scene={scene}
        />
        {eyebrow === undefined ? null : (
          <p className="text-footnote font-extrabold tracking-wide text-tint">{eyebrow}</p>
        )}
        <h1 className="text-title-1 font-extrabold text-balance">{title}</h1>
        <p className="text-callout text-label-2 text-pretty">{copy}</p>
        {children}
      </div>
    </Screen>
  )
}

type SignInProps = Readonly<{
  googleClientId: string | null
  onSignedIn: () => void
  runtime: AppRuntime
}>

/** B1: the only way in is Google, for invited families. */
export function SignInScreen({ googleClientId, onSignedIn, runtime }: SignInProps) {
  const { language, t } = useI18n()
  const button = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const element = button.current
    if (element === null || googleClientId === null) return
    renderGoogleSignInButton({
      clientId: googleClientId,
      element,
      locale: language,
      onCredential: (credential) => {
        setPending(true)
        setError(null)
        void runApi(runtime, (api) => api.signIn(credential))
          .then(onSignedIn)
          .catch((failure: unknown) => {
            const code = (failure as { code?: unknown }).code
            setError(
              t(code === 'google_account_not_allowed' ? 'signIn.notInvited' : 'signIn.failed'),
            )
          })
          .finally(() => setPending(false))
      },
    }).catch(() => setError(t('signIn.buttonUnavailable')))
  }, [googleClientId, language, onSignedIn, runtime, t])

  return (
    <AccessLayout
      bottom={
        <div className="flex flex-col items-center gap-3">
          <div aria-busy={pending} className="flex min-h-13 w-full justify-center" ref={button} />
          <p className="text-footnote text-label-3">{t('signIn.invitedOnly')}</p>
        </div>
      }
      copy={t('signIn.copy')}
      eyebrow="little tables."
      scene="connectProfile"
      title={t('signIn.title')}
    >
      {error === null ? null : (
        <p className="text-subhead font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </AccessLayout>
  )
}

type OnboardingProps = Readonly<{ onDone: () => void; runtime: AppRuntime }>

/** B2: the first child's name; more children can be added in the parent space. */
export function OnboardingScreen({ onDone, runtime }: OnboardingProps) {
  const { t } = useI18n()
  const field = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const trimmed = name.trim()

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    if (pending || trimmed === '') return
    setPending(true)
    setError(null)
    void runApi(runtime, (api) => api.onboarding({ name: trimmed }))
      .then(onDone)
      .catch(() => setError(t('onboarding.failed')))
      .finally(() => setPending(false))
  }

  return (
    <form className="contents" onSubmit={submit}>
      <AccessLayout
        bottom={
          <Button
            disabled={pending || trimmed === ''}
            icon={<Sprout aria-hidden className="size-5" />}
            size="lg"
            type="submit"
            width="full"
          >
            {t('onboarding.open')}
          </Button>
        }
        copy={t('onboarding.copy')}
        scene="home"
        title={t('onboarding.title')}
      >
        <div className="mt-3 w-full text-left">
          <TextField
            autoComplete="given-name"
            counter={`${Array.from(name).length}/40`}
            id={field}
            label={t('onboarding.label')}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        {error === null ? null : (
          <p className="text-subhead font-semibold text-danger" role="alert">
            {error}
          </p>
        )}
      </AccessLayout>
    </form>
  )
}

/** B3: the very first opening needs the Internet; afterwards the app works offline. */
export function OfflineScreen({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useI18n()
  return (
    <AccessLayout
      bottom={
        <Button
          icon={<RefreshCw aria-hidden className="size-5" />}
          onClick={onRetry}
          size="lg"
          width="full"
        >
          {t('offline.retry')}
        </Button>
      }
      copy={t('offline.copy')}
      scene="updateRecovery"
      title={t('offline.title')}
    />
  )
}

/** B4: something broke; progress is safe on the device, reopening fixes it. */
export function RecoveryScreen({ onRecover }: Readonly<{ onRecover: () => void }>) {
  const { t } = useI18n()
  return (
    <AccessLayout
      bottom={
        <Button
          icon={<RotateCcw aria-hidden className="size-5" />}
          onClick={onRecover}
          size="lg"
          width="full"
        >
          {t('recovery.reopen')}
        </Button>
      }
      copy={t('recovery.copy')}
      eyebrow={t('recovery.eyebrow')}
      scene="updateRecovery"
      title={t('recovery.title')}
    />
  )
}

/** While the app decides what to open. */
export function OpeningScreen() {
  const { t } = useI18n()
  return (
    <div className="grid h-dvh place-items-center bg-bg" role="status">
      <p className="text-callout font-semibold text-label-2">{t('opening')}</p>
    </div>
  )
}

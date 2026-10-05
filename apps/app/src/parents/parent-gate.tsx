/**
 * The parent code in front of the parent space (`docs/rewrite/TECHNICAL_SPEC.md` §6.4): chosen on
 * the first visit, checked by the server, or offline against this device's copy, and reset by
 * signing in with Google again.
 */
import { ApiError } from '@little-tables/api-contract'
import { Button, PinPad, Screen, type PadKey } from '@little-tables/ui'
import { useNavigate } from '@tanstack/react-router'
import { LockKeyhole } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import { renderGoogleSignInButton } from '../access/google-identity.js'
import { useApp } from '../app/app-context.js'
import { useI18n } from '../i18n/i18n.js'
import { useApi } from './api.js'
import { parentSpace } from './parent-code.js'

type Step =
  | Readonly<{ kind: 'checking' }>
  | Readonly<{ kind: 'choose'; first: string | null }>
  | Readonly<{ kind: 'enter' }>
  | Readonly<{ kind: 'forgot' }>
  | Readonly<{ kind: 'unavailable'; offline: boolean }>

const isOffline = (failure: unknown) =>
  typeof failure === 'object' &&
  failure !== null &&
  '_tag' in failure &&
  failure._tag === 'NetworkError'

/** Shows `children` while the parent space is open; asks for the code otherwise. */
export function ParentGate({ children }: Readonly<{ children: ReactNode }>) {
  const open = useSyncExternalStore(parentSpace.subscribe, () => parentSpace.isOpen())
  // The space closes by itself five minutes after it opened.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(
      () => parentSpace.close(),
      Math.max(0, parentSpace.openUntil() - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [open])
  return open ? children : <CodeScreen />
}

function CodeScreen() {
  const { device } = useApp()
  const { count, t, timeOf } = useI18n()
  const api = useApi()
  const navigate = useNavigate()
  const code = device.parentCode
  const lockMessage = (lockedUntil: number) => t('lock.locked', { time: timeOf(lockedUntil) })
  const [step, setStep] = useState<Step>({ kind: 'checking' })
  const [digits, setDigits] = useState('')
  const [message, setMessage] = useState<string | null>(() => {
    const until = code.lockedUntil()
    return until === null ? null : lockMessage(until)
  })
  // Only the handlers read it: a submission in flight ignores further keys.
  const busy = useRef(false)
  const showLock = (lockedUntil: number) => setMessage(lockMessage(lockedUntil))

  useEffect(() => {
    let current = true
    api((client) => client.parentLock())
      .then((status) => {
        if (!current) return
        code.reconcile(status.pinSalt)
        if (status.lockedUntil !== null) code.lockUntil(status.lockedUntil)
        setStep(status.configured ? { kind: 'enter' } : { kind: 'choose', first: null })
      })
      .catch((failure: unknown) => {
        if (!current) return
        const offline = isOffline(failure)
        // Offline, the device's copy of the code is enough, if it has one.
        setStep(offline && code.checkable() ? { kind: 'enter' } : { kind: 'unavailable', offline })
      })
    return () => {
      current = false
    }
  }, [api, code])

  const submitEntered = async (pin: string) => {
    try {
      const device = await api((client) => client.verifyParentLock(pin))
      await code.remember(pin, device.pinSalt, device.pinHashParams.iterations)
      parentSpace.open()
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'wrong_pin') {
        setMessage(count('lock.wrong', failure.remainingAttempts ?? 0))
      } else if (failure instanceof ApiError && failure.code === 'parent_lock_locked') {
        const until = failure.lockedUntil ?? Date.now()
        code.lockUntil(until)
        showLock(until)
      } else if (isOffline(failure)) {
        const checked = await code.checkOffline(pin)
        if (checked.kind === 'right') parentSpace.open()
        else if (checked.kind === 'wrong')
          setMessage(count('lock.wrong', checked.remainingAttempts))
        else if (checked.kind === 'locked') showLock(checked.lockedUntil)
        else setStep({ kind: 'unavailable', offline: true })
      } else {
        setMessage(t('lock.unavailable'))
      }
    }
  }

  const submitChosen = async (first: string | null, pin: string) => {
    if (first === null) {
      setStep({ kind: 'choose', first: pin })
      return
    }
    if (first !== pin) {
      setMessage(t('lock.mismatch'))
      setStep({ kind: 'choose', first: null })
      return
    }
    try {
      const device = await api((client) => client.setParentLock(pin))
      await code.remember(pin, device.pinSalt, device.pinHashParams.iterations)
      parentSpace.open()
    } catch {
      setMessage(t('lock.unavailable'))
      setStep({ kind: 'choose', first: null })
    }
  }

  const onKey = (key: PadKey) => {
    if (busy.current || code.lockedUntil() !== null) return
    if (key === 'erase') {
      setDigits((current) => current.slice(0, -1))
      return
    }
    if (key === 'submit') return
    const next = `${digits}${key}`
    if (next.length < 4) {
      setDigits(next)
      setMessage(null)
      return
    }
    setDigits('')
    busy.current = true
    const done = () => {
      busy.current = false
    }
    if (step.kind === 'choose') void submitChosen(step.first, next).finally(done)
    else void submitEntered(next).finally(done)
  }

  const leave = () => void navigate({ to: '/' })
  const title =
    step.kind === 'choose'
      ? t(step.first === null ? 'lock.chooseTitle' : 'lock.confirmTitle')
      : step.kind === 'forgot'
        ? t('lock.forgotTitle')
        : t('lock.enterTitle')

  return (
    <Screen
      top={
        <div className="flex min-h-11 justify-end px-5 pt-2">
          <Button onClick={leave} size="sm" variant="plain">
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-4 text-center">
        <LockKeyhole aria-hidden className="size-9 text-tint" />
        <h1 className="text-title-2 font-extrabold">{title}</h1>
        {step.kind === 'checking' ? null : step.kind === 'unavailable' ? (
          <p className="text-body text-label-2">
            {t(step.offline ? 'lock.offlineUnknown' : 'lock.unavailable')}
          </p>
        ) : step.kind === 'forgot' ? (
          <Forgot
            onReset={() => {
              code.forget()
              setMessage(null)
              setStep({ kind: 'choose', first: null })
            }}
          />
        ) : (
          <>
            <p aria-live="polite" className="min-h-10 text-subhead font-semibold text-label-2">
              {message ?? (step.kind === 'choose' ? t('lock.chooseCopy') : '')}
            </p>
            <PinPad
              eraseLabel={t('lock.erase')}
              onKey={onKey}
              progressLabel={t('lock.progress', { count: digits.length })}
              value={digits}
            />
            {step.kind === 'enter' ? (
              <Button
                onClick={() => {
                  setMessage(null)
                  setStep({ kind: 'forgot' })
                }}
                size="sm"
                variant="plain"
              >
                {t('lock.forgot')}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Screen>
  )
}

/** Signing in with Google again, just now, lets the family choose a new code. */
function Forgot({ onReset }: Readonly<{ onReset: () => void }>) {
  const { language, t } = useI18n()
  const api = useApi()
  const button = useRef<HTMLDivElement>(null)
  const [clientId, setClientId] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    api((client) => client.authStatus())
      .then((status) => {
        if (current) setClientId(status.authenticationRequired ? status.googleClientId : null)
      })
      .catch(() => {
        if (current) setError(t('lock.unavailable'))
      })
    return () => {
      current = false
    }
  }, [api, t])

  const reset = (credential: string | null) => {
    api((client) => client.resetParentLock(credential))
      .then(onReset)
      .catch(() => setError(t('lock.resetFailed')))
  }
  const onCredential = useEffectEvent(reset)

  useEffect(() => {
    const element = button.current
    if (element === null || clientId === undefined || clientId === null) return
    void renderGoogleSignInButton({
      clientId,
      element,
      locale: language,
      onCredential: (credential) => onCredential(credential),
    })
  }, [clientId, language])

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="text-body text-label-2">{t('lock.forgotCopy')}</p>
      {clientId === null ? (
        <Button onClick={() => reset(null)} variant="tinted">
          {t('lock.reset')}
        </Button>
      ) : (
        <div className="flex min-h-11 w-full justify-center" ref={button} />
      )}
      {error === null ? null : (
        <p className="text-subhead font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

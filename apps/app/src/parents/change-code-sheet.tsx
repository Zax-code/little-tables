/** Changing the parent code from the settings: the current code, then the new one twice. */
import { ApiError } from '@little-tables/api-contract'
import { PinPad, Sheet, toast, type PadKey } from '@little-tables/ui'
import { useRef, useState } from 'react'

import { useApp } from '../app/app-context.js'
import { useI18n } from '../i18n/i18n.js'
import { useApi } from './api.js'

type Stage =
  | Readonly<{ kind: 'current' }>
  | Readonly<{ current: string; kind: 'new' }>
  | Readonly<{ current: string; first: string; kind: 'confirm' }>

const start: Stage = { kind: 'current' }

export function ChangeCodeSheet({
  onOpenChange,
  open,
}: Readonly<{ onOpenChange: (open: boolean) => void; open: boolean }>) {
  const { device } = useApp()
  const { count, t } = useI18n()
  const api = useApi()
  const [stage, setStage] = useState<Stage>(start)
  const [digits, setDigits] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  // Only the handlers read it: a save in flight ignores further keys.
  const busy = useRef(false)

  const close = (next: boolean) => {
    if (!next) {
      setStage(start)
      setDigits('')
      setMessage(null)
    }
    onOpenChange(next)
  }

  const save = async (current: string, pin: string) => {
    try {
      const saved = await api((client) => client.setParentLock(pin, current))
      await device.parentCode.remember(pin, saved.pinSalt, saved.pinHashParams.iterations)
      toast.success(t('lock.changed'))
      close(false)
    } catch (failure) {
      setStage(start)
      if (failure instanceof ApiError && failure.code === 'wrong_pin') {
        setMessage(count('lock.wrong', failure.remainingAttempts ?? 0))
      } else if (failure instanceof ApiError && failure.code === 'parent_lock_locked') {
        if (failure.lockedUntil !== undefined) device.parentCode.lockUntil(failure.lockedUntil)
        close(false)
      } else {
        setMessage(t('lock.unavailable'))
      }
    }
  }

  const onKey = (key: PadKey) => {
    if (busy.current || key === 'submit') return
    if (key === 'erase') {
      setDigits((current) => current.slice(0, -1))
      return
    }
    const next = `${digits}${key}`
    if (next.length < 4) {
      setDigits(next)
      setMessage(null)
      return
    }
    setDigits('')
    if (stage.kind === 'current') setStage({ current: next, kind: 'new' })
    else if (stage.kind === 'new')
      setStage({ current: stage.current, first: next, kind: 'confirm' })
    else if (stage.first !== next) {
      setMessage(t('lock.mismatch'))
      setStage({ current: stage.current, kind: 'new' })
    } else {
      busy.current = true
      void save(stage.current, next).finally(() => {
        busy.current = false
      })
    }
  }

  const title = t(
    stage.kind === 'current'
      ? 'lock.currentTitle'
      : stage.kind === 'new'
        ? 'lock.newTitle'
        : 'lock.confirmTitle',
  )
  return (
    <Sheet closeLabel={t('common.close')} onOpenChange={close} open={open} title={t('lock.change')}>
      <div className="flex flex-col items-center gap-5 pb-4 text-center">
        <h3 className="text-headline font-extrabold">{title}</h3>
        <p aria-live="polite" className="min-h-6 text-subhead font-semibold text-label-2">
          {message ?? ''}
        </p>
        <PinPad
          eraseLabel={t('lock.erase')}
          onKey={onKey}
          progressLabel={t('lock.progress', { count: digits.length })}
          value={digits}
        />
      </div>
    </Sheet>
  )
}

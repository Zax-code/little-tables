/**
 * Keeps the device and the server in step (`docs/rewrite/TECHNICAL_SPEC.md` §4.3): on opening,
 * when the network comes back, when the app returns to the foreground and after each session.
 * The child never sees it; the parent space shows its state.
 */
import { ApiClient } from '@little-tables/api-contract'
import { useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { LocalStore } from '../data/local-store.js'
import { synchronize } from '../data/sync.js'
import { useApp } from './app-context.js'
import { profileStateKey } from './profile-state.js'

export type SyncState = Readonly<{ kind: 'error' | 'idle' | 'syncing'; pending: number }>

type SyncContextValue = Readonly<{ state: SyncState; synchronize: () => Promise<void> }>

const SyncContext = createContext<SyncContextValue>({
  state: { kind: 'idle', pending: 0 },
  synchronize: () => Promise.resolve(),
})

export const useSync = () => use(SyncContext)

const FIRST_SYNC_DELAY_MS = 1500

export function SyncManager({ children }: Readonly<{ children: ReactNode }>) {
  const { activeProfile, device, family, reopen, runtime, setProfiles } = useApp()
  const queryClient = useQueryClient()
  const [state, setState] = useState<SyncState>({ kind: 'idle', pending: 0 })
  const running = useRef<Promise<void> | null>(null)
  const latest = useRef({ activeProfile, family })
  useEffect(() => {
    latest.current = { activeProfile, family }
  }, [activeProfile, family])

  const countPending = useCallback(
    () =>
      runtime.runPromise(
        Effect.flatMap(LocalStore, (store) =>
          Effect.reduce(latest.current.family.profiles, 0, (total, profile) =>
            Effect.map(store.pendingCount(profile.id), (count) => total + count),
          ),
        ),
      ),
    [runtime],
  )

  const run = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState({ kind: 'idle', pending: await countPending() })
      return
    }
    setState((current) => ({ ...current, kind: 'syncing' }))
    const { activeProfile: active, family: current } = latest.current
    const outcome = await runtime.runPromise(
      synchronize({
        activeProfileId: active.id,
        profileIds: current.profiles.map(({ id }) => id),
      }).pipe(
        Effect.flatMap((result) =>
          Effect.flatMap(ApiClient, (api) =>
            Effect.all({
              // A code changed elsewhere makes this device's offline copy useless.
              lock: Effect.option(api.parentLock()),
              profiles: Effect.map(api.profiles(), ({ profiles }) => profiles),
            }),
          ).pipe(Effect.map(({ lock, profiles }) => ({ lock, profiles, result }))),
        ),
        Effect.either,
      ),
    )
    if (outcome._tag === 'Left') {
      if (outcome.left._tag === 'SignedOut') {
        device.setAuthGrant(null)
        reopen()
        return
      }
      setState({ kind: 'error', pending: await countPending() })
      return
    }
    const { lock, profiles, result } = outcome.right
    if (lock._tag === 'Some') device.parentCode.reconcile(lock.value.pinSalt)
    await Promise.all(
      result.gone.map((gone) =>
        runtime.runPromise(Effect.flatMap(LocalStore, (store) => store.remove(gone))),
      ),
    )
    setProfiles(profiles)
    const grant = device.authGrant()
    if (grant !== null && result.sessionExpiresAt !== null) {
      device.setAuthGrant({ ...grant, expiresAt: result.sessionExpiresAt })
    }
    if (result.merged) await queryClient.invalidateQueries({ queryKey: profileStateKey(active.id) })
    setState({ kind: 'idle', pending: await countPending() })
  }, [countPending, device, queryClient, reopen, runtime, setProfiles])

  const synchronizeNow = useCallback(() => {
    running.current ??= run().finally(() => {
      running.current = null
    })
    return running.current
  }, [run])

  useEffect(() => {
    const timer = window.setTimeout(() => void synchronizeNow(), FIRST_SYNC_DELAY_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void synchronizeNow()
    }
    const onOnline = () => void synchronizeNow()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [synchronizeNow])

  const value = useMemo(() => ({ state, synchronize: synchronizeNow }), [state, synchronizeNow])
  return <SyncContext value={value}>{children}</SyncContext>
}

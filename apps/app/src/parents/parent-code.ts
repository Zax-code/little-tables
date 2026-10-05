/**
 * The parent code on this device (`docs/rewrite/TECHNICAL_SPEC.md` §6.4). The server checks the
 * code; after each success the device keeps a PBKDF2 hash of it, with the server's salt, to check
 * it offline. Five wrong codes lock it for fifteen minutes here too, and an opened parent space
 * stays open five minutes or until the child space shows again.
 */
import { Either, Schema } from 'effect'

export const MAX_FAILURES = 5
export const LOCK_MS = 15 * 60_000
export const UNLOCK_MS = 5 * 60_000

const storageKey = 'little-tables:parent-code'

const DeviceCode = Schema.Struct({
  failures: Schema.Number,
  /** Base64 PBKDF2-SHA-256 of the code; null until a first online check. */
  hash: Schema.NullOr(Schema.String),
  iterations: Schema.Number,
  lockedUntil: Schema.NullOr(Schema.Number),
  pinSalt: Schema.NullOr(Schema.String),
})
type DeviceCode = typeof DeviceCode.Type

const empty: DeviceCode = {
  failures: 0,
  hash: null,
  iterations: 100_000,
  lockedUntil: null,
  pinSalt: null,
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'removeItem' | 'setItem'>

const defaultStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const bytes = (text: string) => new TextEncoder().encode(text)

const base64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))

/** PBKDF2-SHA-256 of the code with the server's salt, as base64. */
export const hashCode = async (pin: string, pinSalt: string, iterations: number) => {
  const key = await crypto.subtle.importKey('raw', bytes(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { hash: 'SHA-256', iterations, name: 'PBKDF2', salt: bytes(pinSalt) },
    key,
    256,
  )
  return base64(bits)
}

export type OfflineCheck =
  | Readonly<{ kind: 'locked'; lockedUntil: number }>
  | Readonly<{ kind: 'right' }>
  | Readonly<{ kind: 'unknown' }>
  | Readonly<{ kind: 'wrong'; remainingAttempts: number }>

export const createParentCode = (storage: Storage | null = defaultStorage()) => {
  const read = (): DeviceCode => {
    try {
      const text = storage?.getItem(storageKey) ?? null
      if (text === null) return empty
      const decoded = Schema.decodeUnknownEither(DeviceCode)(JSON.parse(text))
      return Either.isRight(decoded) ? decoded.right : empty
    } catch {
      return empty
    }
  }
  const write = (value: DeviceCode) => {
    try {
      storage?.setItem(storageKey, JSON.stringify(value))
    } catch {
      // Without storage the code is checked online only.
    }
  }

  return {
    /** Whether this device can check the code offline. */
    checkable: () => read().hash !== null,

    /** Until when wrong codes keep it closed on this device, if they do. */
    lockedUntil: (now = Date.now()) => {
      const until = read().lockedUntil
      return until !== null && until > now ? until : null
    },

    /** Keeps the device's copy after the server accepted `pin`. */
    remember: async (pin: string, pinSalt: string, iterations: number) => {
      write({
        failures: 0,
        hash: await hashCode(pin, pinSalt, iterations),
        iterations,
        lockedUntil: null,
        pinSalt,
      })
    },

    /** Drops the copy when the server's code changed (another salt) or no longer exists. */
    reconcile: (serverSalt: string | null) => {
      const current = read()
      if (current.pinSalt !== null && current.pinSalt !== serverSalt) write(empty)
    },

    /** Mirrors the server's lock after it refused a code. */
    lockUntil: (lockedUntil: number) => write({ ...read(), failures: 0, lockedUntil }),

    /** Checks `pin` against the device's copy, counting a wrong one. */
    checkOffline: async (pin: string, now = Date.now()): Promise<OfflineCheck> => {
      const current = read()
      if (current.lockedUntil !== null && current.lockedUntil > now) {
        return { kind: 'locked', lockedUntil: current.lockedUntil }
      }
      if (current.hash === null || current.pinSalt === null) return { kind: 'unknown' }
      if ((await hashCode(pin, current.pinSalt, current.iterations)) === current.hash) {
        write({ ...current, failures: 0, lockedUntil: null })
        return { kind: 'right' }
      }
      const failures = current.failures + 1
      if (failures >= MAX_FAILURES) {
        write({ ...current, failures: 0, lockedUntil: now + LOCK_MS })
        return { kind: 'locked', lockedUntil: now + LOCK_MS }
      }
      write({ ...current, failures, lockedUntil: null })
      return { kind: 'wrong', remainingAttempts: MAX_FAILURES - failures }
    },

    forget: () => {
      try {
        storage?.removeItem(storageKey)
      } catch {
        // Nothing kept, nothing to forget.
      }
    },
  }
}

export type ParentCode = ReturnType<typeof createParentCode>

/* The open parent space, shared by every screen of this page. -------------------------------- */

let openUntil = 0
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

export const parentSpace = {
  isOpen: (now = Date.now()) => openUntil > now,
  open: (now = Date.now()) => {
    openUntil = now + UNLOCK_MS
    notify()
  },
  close: () => {
    if (openUntil === 0) return
    openUntil = 0
    notify()
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
  /** When the space closes by itself. */
  openUntil: () => openUntil,
}

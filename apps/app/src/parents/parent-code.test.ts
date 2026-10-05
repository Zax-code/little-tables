import { describe, expect, it } from 'vitest'

import { createParentCode, hashCode, LOCK_MS, parentSpace, UNLOCK_MS } from './parent-code.js'

const memoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

describe('the parent code on this device', () => {
  it('hashes like WebCrypto PBKDF2-SHA-256 does, salt by salt', async () => {
    const first = await hashCode('2468', 'salt-a', 1000)
    expect(first).toHaveLength(44)
    expect(await hashCode('2468', 'salt-a', 1000)).toBe(first)
    expect(await hashCode('2468', 'salt-b', 1000)).not.toBe(first)
    expect(await hashCode('1357', 'salt-a', 1000)).not.toBe(first)
  })

  it('checks offline only after a first online check', async () => {
    const code = createParentCode(memoryStorage())
    expect(await code.checkOffline('2468')).toEqual({ kind: 'unknown' })
    expect(code.checkable()).toBe(false)
    await code.remember('2468', 'salt', 1000)
    expect(code.checkable()).toBe(true)
    expect(await code.checkOffline('2468')).toEqual({ kind: 'right' })
  })

  it('locks for fifteen minutes after five wrong codes, then starts counting again', async () => {
    const code = createParentCode(memoryStorage())
    await code.remember('2468', 'salt', 1000)
    for (const remainingAttempts of [4, 3, 2, 1]) {
      expect(await code.checkOffline('0000', 0)).toEqual({ kind: 'wrong', remainingAttempts })
    }
    expect(await code.checkOffline('0000', 0)).toEqual({ kind: 'locked', lockedUntil: LOCK_MS })
    expect(await code.checkOffline('2468', LOCK_MS - 1)).toEqual({
      kind: 'locked',
      lockedUntil: LOCK_MS,
    })
    expect(code.lockedUntil(LOCK_MS - 1)).toBe(LOCK_MS)
    expect(code.lockedUntil(LOCK_MS)).toBeNull()
    expect(await code.checkOffline('0000', LOCK_MS)).toEqual({
      kind: 'wrong',
      remainingAttempts: 4,
    })
    expect(await code.checkOffline('2468', LOCK_MS)).toEqual({ kind: 'right' })
  })

  it('drops its copy when the server’s code changed or was reset', async () => {
    const code = createParentCode(memoryStorage())
    await code.remember('2468', 'salt', 1000)
    code.reconcile('salt')
    expect(code.checkable()).toBe(true)
    code.reconcile('another salt')
    expect(code.checkable()).toBe(false)
    await code.remember('2468', 'salt', 1000)
    code.reconcile(null)
    expect(code.checkable()).toBe(false)
  })

  it('survives unreadable storage', async () => {
    const storage = memoryStorage()
    storage.setItem('little-tables:parent-code', '{not json')
    const code = createParentCode(storage)
    expect(code.checkable()).toBe(false)
    expect(await code.checkOffline('2468')).toEqual({ kind: 'unknown' })
  })
})

describe('the open parent space', () => {
  it('stays open five minutes, or until it is closed', () => {
    let changes = 0
    const stop = parentSpace.subscribe(() => (changes += 1))
    parentSpace.open(1000)
    expect(parentSpace.isOpen(1000 + UNLOCK_MS - 1)).toBe(true)
    expect(parentSpace.isOpen(1000 + UNLOCK_MS)).toBe(false)
    parentSpace.close()
    expect(parentSpace.isOpen(1001)).toBe(false)
    parentSpace.close()
    stop()
    expect(changes).toBe(2)
  })
})

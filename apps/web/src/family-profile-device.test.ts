import { describe, expect, it } from 'vitest'

import {
  clearFamilyProfileDeviceState,
  readCachedProfiles,
  readRememberedProfileId,
  rememberActiveProfile,
  resolveActiveProfileId,
  writeCachedProfiles,
} from './family-profile-device.js'

class MemoryStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const profiles = [
  { avatarId: 'sprout', id: 'child-1', name: 'Lou' },
  { avatarId: 'bluebell', id: 'child-2', name: 'Mia' },
] as const

describe('family profile device state', () => {
  it('remembers the active child on this device and restores it while that child still exists', () => {
    const storage = new MemoryStorage()
    rememberActiveProfile('child-2', storage)
    writeCachedProfiles(profiles, storage)

    expect(readRememberedProfileId(storage)).toBe('child-2')
    expect(readCachedProfiles(storage)).toEqual(profiles)
    expect(resolveActiveProfileId(profiles, readRememberedProfileId(storage))).toBe('child-2')

    clearFamilyProfileDeviceState(storage)
    expect(readRememberedProfileId(storage)).toBeNull()
    expect(readCachedProfiles(storage)).toEqual([])
  })

  it('falls back safely when the remembered child was removed', () => {
    expect(resolveActiveProfileId([profiles[0]], 'child-2')).toBe('child-1')
    expect(resolveActiveProfileId([], 'child-2')).toBeNull()
  })
})

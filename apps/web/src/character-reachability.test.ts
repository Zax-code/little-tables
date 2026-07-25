/// <reference types="node" />

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('character scene reachability', () => {
  it('does not reference retired flat Miffy scene paths from active runtime code', () => {
    const webRoot = new URL('..', import.meta.url)
    const activeFiles = [
      ...readdirSync(new URL('src/', webRoot), {
        encoding: 'utf8',
        recursive: true,
      })
        .filter(
          (path) =>
            (path.endsWith('.ts') || path.endsWith('.tsx')) &&
            !path.endsWith('.test.ts') &&
            !path.endsWith('.test.tsx'),
        )
        .map((path) => `src/${path}`),
      'index.html',
    ]

    for (const relativePath of activeFiles) {
      const source = readFileSync(new URL(relativePath, webRoot), 'utf8')
      expect(source, relativePath).not.toMatch(/\/generated\/miffy-[^'")\s]+/)
    }
  })
})

import { describe, expect, it, vi } from 'vitest'

import { preloadImageSources, type PreloadableImage } from './preload-images.js'

function createPendingImage(): PreloadableImage {
  return {
    complete: false,
    decode: vi.fn(() => Promise.resolve()),
    onerror: null,
    onload: null,
    src: '',
  }
}

describe('preloadImageSources', () => {
  it('waits for every image to load and decode before resolving', async () => {
    const images = [createPendingImage(), createPendingImage()]
    const preload = preloadImageSources(['/first.png', '/second.png'], () => {
      const image = images.find((candidate) => candidate.src === '')
      if (image === undefined) throw new Error('Unexpected image request')
      image.src = 'reserved'
      return image
    })

    expect(images.map(({ src }) => src)).toEqual(['/first.png', '/second.png'])

    images[0]?.onload?.(new Event('load'))
    await Promise.resolve()
    expect(await Promise.race([preload.then(() => 'done'), Promise.resolve('pending')])).toBe(
      'pending',
    )

    images[1]?.onload?.(new Event('load'))
    await expect(preload).resolves.toBeUndefined()
    expect(images.map(({ decode }) => decode)).toEqual([expect.any(Function), expect.any(Function)])
  })

  it('does not strand the app when an image cannot be loaded', async () => {
    const image = createPendingImage()
    const preload = preloadImageSources(['/missing.png'], () => image)

    image.onerror?.(new Event('error'))

    await expect(preload).resolves.toBeUndefined()
  })

  it('stops waiting after the startup budget when a request stalls', async () => {
    vi.useFakeTimers()
    const image = createPendingImage()
    const preload = preloadImageSources(['/stalled.png'], () => image, 5_000)

    await vi.advanceTimersByTimeAsync(5_000)

    await expect(preload).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})

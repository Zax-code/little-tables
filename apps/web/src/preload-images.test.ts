import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  decodeStartupImages,
  decodeRouteImages,
  preloadImageSources,
  type PreloadableImage,
} from './preload-images.js'

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
  afterEach(() => vi.unstubAllGlobals())

  it('only gates rendering on images marked for the first screen', async () => {
    const querySelectorAll = vi.fn(() => [
      { href: 'https://little-tables.test/miffy-home.webp' },
      { href: 'https://little-tables.test/miffy-google-connect.webp' },
    ])
    const images: PreloadableImage[] = []
    class ImageConstructor implements PreloadableImage {
      complete = true
      decode = vi.fn(() => Promise.resolve())
      onerror = null
      onload = null
      src = ''

      constructor() {
        images.push(this)
      }
    }
    vi.stubGlobal('document', { querySelectorAll })
    vi.stubGlobal('Image', ImageConstructor)

    await decodeStartupImages()

    expect(querySelectorAll).toHaveBeenCalledWith('link[data-app-image][data-startup-image]')
    expect(images).toHaveLength(2)
  })

  it('reuses decoded route images on later visits', async () => {
    const images: PreloadableImage[] = []
    class ImageConstructor implements PreloadableImage {
      complete = true
      decode = vi.fn(() => Promise.resolve())
      onerror = null
      onload = null
      src = ''

      constructor() {
        images.push(this)
      }
    }
    vi.stubGlobal('Image', ImageConstructor)

    const firstVisit = decodeRouteImages('test-route', ['/route-image.webp'])
    const laterVisit = decodeRouteImages('test-route', ['/route-image.webp'])

    expect(laterVisit).toBe(firstVisit)
    await expect(firstVisit).resolves.toBeUndefined()
    expect(images).toHaveLength(1)
  })

  it('does not reuse another profile character when a route source changes', async () => {
    class ImageConstructor implements PreloadableImage {
      complete = true
      decode = vi.fn(() => Promise.resolve())
      onerror = null
      onload = null
      src = ''
    }
    vi.stubGlobal('Image', ImageConstructor)

    const fenna = decodeRouteImages('practice', ['/characters/fenna-fox/practice-idle.webp'])
    const paco = decodeRouteImages('practice', ['/characters/paco-dog/practice-idle.webp'])

    expect(fenna).not.toBe(paco)
    await Promise.all([fenna, paco])
  })

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

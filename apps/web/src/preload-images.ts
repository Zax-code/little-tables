export type PreloadableImage = {
  complete: boolean
  decode?: () => Promise<unknown>
  onerror: ((event: Event) => unknown) | null
  onload: ((event: Event) => unknown) | null
  src: string
}

type ImageFactory = () => PreloadableImage
const routeImageDecodes = new Map<string, Promise<void>>()

function preloadImageSource(
  source: string,
  createImage: ImageFactory,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const image = createImage()
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve()
    }
    const finishAfterDecode = () => {
      const decoding = image.decode?.()
      if (decoding === undefined) {
        finish()
        return
      }
      void decoding.catch(() => undefined).then(finish)
    }

    image.onload = finishAfterDecode
    image.onerror = finish
    const timeout = setTimeout(finish, timeoutMs)
    image.src = source

    if (image.complete) finishAfterDecode()
  })
}

export async function preloadImageSources(
  sources: readonly string[],
  createImage: ImageFactory = () => new Image(),
  timeoutMs = 8_000,
): Promise<void> {
  await Promise.all(sources.map((source) => preloadImageSource(source, createImage, timeoutMs)))
}

export function decodeStartupImages(): Promise<void> {
  const sources = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[data-app-image][data-startup-image]'),
    ({ href }) => href,
  )
  return preloadImageSources(sources)
}

export function decodeRouteImages(route: string, sources: readonly string[]): Promise<void> {
  const existing = routeImageDecodes.get(route)
  if (existing !== undefined) return existing

  const decoding = preloadImageSources(sources)
  routeImageDecodes.set(route, decoding)
  return decoding
}

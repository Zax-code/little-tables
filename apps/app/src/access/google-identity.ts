import type { Language } from '../data/schema.js'

type CredentialResponse = Readonly<{ credential: string }>

type GoogleIdentityApi = Readonly<{
  initialize: (
    configuration: Readonly<{
      callback: (response: CredentialResponse) => void
      client_id: string
    }>,
  ) => void
  renderButton: (
    parent: HTMLElement,
    options: Readonly<{
      locale: string
      shape: string
      size: string
      text: string
      theme: string
      type: string
      width: number
    }>,
  ) => void
}>

type GoogleWindow = Window & {
  google?: Readonly<{ accounts: Readonly<{ id: GoogleIdentityApi }> }>
}

let scriptPromise: Promise<GoogleIdentityApi> | undefined
let initializedClientId: string | undefined
let credentialHandler: ((credential: string) => void) | undefined

export const googleIdentityLocale = (locale: Language): string =>
  locale === 'zh-Hans' ? 'zh_CN' : locale

const loadGoogleIdentity = (): Promise<GoogleIdentityApi> => {
  const googleWindow = window as GoogleWindow
  if (googleWindow.google !== undefined) return Promise.resolve(googleWindow.google.accounts.id)
  if (scriptPromise !== undefined) return scriptPromise
  const pending = new Promise<GoogleIdentityApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.referrerPolicy = 'strict-origin-when-cross-origin'
    script.src = 'https://accounts.google.com/gsi/client'
    script.addEventListener('load', () => {
      if (googleWindow.google === undefined) {
        reject(new Error('Google Identity Services did not initialize.'))
        return
      }
      resolve(googleWindow.google.accounts.id)
    })
    script.addEventListener('error', () =>
      reject(new Error('Google Identity Services failed to load.')),
    )
    document.head.append(script)
  })
  const result = pending.catch((error: unknown): never => {
    scriptPromise = undefined
    throw error
  })
  scriptPromise = result
  return result
}

export async function renderGoogleSignInButton({
  clientId,
  element,
  locale,
  onCredential,
}: Readonly<{
  clientId: string
  element: HTMLElement
  locale: Language
  onCredential: (credential: string) => void
}>): Promise<void> {
  const identity = await loadGoogleIdentity()
  credentialHandler = onCredential
  if (initializedClientId !== clientId) {
    identity.initialize({
      callback: ({ credential }) => credentialHandler?.(credential),
      client_id: clientId,
    })
    initializedClientId = clientId
  }
  element.replaceChildren()
  identity.renderButton(element, {
    locale: googleIdentityLocale(locale),
    shape: 'pill',
    size: 'large',
    text: 'signin_with',
    theme: 'outline',
    type: 'standard',
    width: Math.min(320, Math.max(240, element.clientWidth)),
  })
}

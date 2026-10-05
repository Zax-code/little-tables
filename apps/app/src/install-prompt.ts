/** The browser's install prompt, kept from page load until the child or a parent asks for it. */
import { useState } from 'react'

type InstallPrompt = Event & { prompt: () => Promise<void> }

let deferred: InstallPrompt | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPrompt
  })
}

export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true)

const isApple = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) &&
  'ontouchend' in document

/** Opens the browser's prompt, or explains the steps when there is none. */
export function useInstall() {
  const [explaining, setExplaining] = useState(false)
  const install = () => {
    if (deferred !== null) {
      void deferred.prompt().finally(() => {
        deferred = null
      })
      return
    }
    setExplaining(true)
  }
  return {
    explaining,
    install,
    setExplaining,
    supported: !isInstalled() && (deferred !== null || isApple()),
  }
}

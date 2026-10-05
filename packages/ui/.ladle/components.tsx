import { ThemeState, type GlobalProvider } from '@ladle/react'
import { useEffect } from 'react'

import './ladle.css'

export const Provider: GlobalProvider = ({ children, globalState }) => {
  useEffect(() => {
    document.documentElement.dataset.theme =
      globalState.theme === ThemeState.Dark ? 'dark' : 'light'
  }, [globalState.theme])
  return <div className="min-h-dvh bg-bg p-4 font-sans text-label">{children}</div>
}

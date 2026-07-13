import type { PropsWithChildren, ReactNode } from 'react'

import { BottomNav } from './bottom-nav.js'
import { PwaManager } from './pwa-manager.js'

type ScreenProps = PropsWithChildren<
  Readonly<{
    footer?: boolean
    header?: ReactNode
  }>
>

export function Screen({ children, footer = true, header }: ScreenProps) {
  return (
    <div className="app-shell">
      {header}
      <main className={footer ? 'screen-content' : 'screen-content screen-content-full'}>
        {children}
      </main>
      {footer ? <BottomNav /> : null}
      <PwaManager />
    </div>
  )
}

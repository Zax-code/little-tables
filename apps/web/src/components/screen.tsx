import type { PropsWithChildren, ReactNode } from 'react'

import { BottomNav } from './bottom-nav.js'
import { PwaManager } from './pwa-manager.js'

type ScreenProps = PropsWithChildren<
  Readonly<{
    contentClassName?: string
    footer?: boolean
    header?: ReactNode
  }>
>

export function Screen({ children, contentClassName, footer = true, header }: ScreenProps) {
  const mainClassName = [
    footer ? 'screen-content' : 'screen-content screen-content-full',
    contentClassName,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="app-shell">
      {header}
      <main className={mainClassName}>{children}</main>
      {footer ? <BottomNav /> : null}
      <PwaManager />
    </div>
  )
}

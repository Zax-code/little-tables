import type { PropsWithChildren, ReactNode } from 'react'

import { BottomNav } from './bottom-nav.js'

type ScreenProps = PropsWithChildren<
  Readonly<{
    contentClassName?: string
    footer?: boolean
    header?: ReactNode
  }>
>

export function Screen({ children, contentClassName, footer = true, header }: ScreenProps) {
  const shellClassName = footer ? 'app-shell app-shell-tabs' : 'app-shell app-shell-standalone'
  const mainClassName = [
    footer ? 'screen-content' : 'screen-content screen-content-full',
    contentClassName,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClassName}>
      {header}
      <main className={mainClassName}>{children}</main>
      {footer ? <BottomNav /> : null}
    </div>
  )
}

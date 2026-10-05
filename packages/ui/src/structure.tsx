import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { Slot } from '@radix-ui/react-slot'
import { ChevronLeft, X } from 'lucide-react'
import { cloneElement, isValidElement, type ComponentPropsWithRef, type ReactNode } from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { Drawer } from 'vaul'

import { Button } from './button.js'
import { cn } from './cn.js'

export type ScreenProps = Readonly<{
  /** Pinned to the bottom, inside the safe area: the primary action or the tab bar. */
  bottom?: ReactNode
  children: ReactNode
  className?: string
  /** Top bar: a profile pill, a navigation bar or a session bar. */
  top?: ReactNode
  tone?: 'bg' | 'grouped'
}>

/** One full-height screen with safe areas, a scrolling body and an optional pinned bottom. */
export function Screen({ bottom, children, className, top, tone = 'bg' }: ScreenProps) {
  return (
    <div
      className={cn(
        'flex h-dvh flex-col overflow-hidden safe-top',
        tone === 'grouped' ? 'bg-surface-2' : 'bg-bg',
        className,
      )}
    >
      {top}
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 pb-4">
        {children}
      </main>
      {bottom === undefined ? null : <div className="safe-bottom px-4 pb-3">{bottom}</div>}
    </div>
  )
}

export type NavigationBarProps = Readonly<{
  action?: ReactNode
  back?: Readonly<{ label: string; onBack: () => void }>
  title: ReactNode
}>

/** A back button and an action on one row, a large title below. */
export function NavigationBar({ action, back, title }: NavigationBarProps) {
  return (
    <header className="flex flex-col gap-1 px-5 pt-2 pb-3">
      <div className="flex min-h-11 items-center justify-between">
        {back === undefined ? (
          <span />
        ) : (
          <button
            className="-ml-2 flex min-h-11 items-center gap-0.5 pr-2 text-body font-semibold text-tint"
            onClick={back.onBack}
            type="button"
          >
            <ChevronLeft aria-hidden className="size-6.5" />
            {back.label}
          </button>
        )}
        {action}
      </div>
      <h1 className="text-large-title font-extrabold leading-tight">{title}</h1>
    </header>
  )
}

export type TabBarProps = Readonly<{ children: ReactNode; label: string }>

/** The floating capsule tab bar. Put `TabBarItem` elements inside. */
export function TabBar({ children, label }: TabBarProps) {
  return (
    <nav
      aria-label={label}
      className="mx-auto flex h-17 w-full max-w-md gap-1 rounded-full border border-separator bg-glass p-1.5 shadow-[0_8px_24px_var(--lt-shadow)] backdrop-blur-xl"
    >
      {children}
    </nav>
  )
}

export type TabBarItemProps = Readonly<{
  active: boolean
  /** The link element of the app's router; it receives the item's look. */
  children: ReactNode
  icon: ReactNode
  label: string
}>

export function TabBarItem({ active, children, icon, label }: TabBarItemProps) {
  return (
    <Slot
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[0.75rem] font-extrabold transition-colors',
        active ? 'bg-tint-soft text-tint' : 'text-label-2',
      )}
    >
      {withContent(children, icon, label)}
    </Slot>
  )
}

/** Lets a router link wrap the icon and label without repeating them. */
function withContent(link: ReactNode, icon: ReactNode, label: string): ReactNode {
  if (!isValidElement(link)) return link
  return cloneElement(
    link,
    undefined,
    <>
      <span aria-hidden className="[&_svg]:size-6">
        {icon}
      </span>
      {label}
    </>,
  )
}

export type SheetProps = Readonly<{
  children: ReactNode
  closeLabel?: string
  description?: ReactNode
  onOpenChange: (open: boolean) => void
  open: boolean
  title: ReactNode
}>

/** A bottom sheet with a grabber, a title and a close button; swipe down to dismiss. */
export function Sheet({
  children,
  closeLabel = 'Fermer',
  description,
  onOpenChange,
  open,
  title,
}: SheetProps) {
  return (
    <Drawer.Root onOpenChange={onOpenChange} open={open}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-sheet bg-bg outline-none safe-bottom">
          <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1.25 w-10 rounded-full bg-label-3" />
          <div className="flex items-start justify-between gap-3 px-4 pt-2 pb-3">
            <div className="flex flex-col gap-0.5">
              <Drawer.Title className="text-title-2 font-extrabold">{title}</Drawer.Title>
              {description === undefined ? (
                <Drawer.Description className="sr-only">{title}</Drawer.Description>
              ) : (
                <Drawer.Description className="text-subhead font-semibold text-label-2">
                  {description}
                </Drawer.Description>
              )}
            </div>
            <Drawer.Close
              aria-label={closeLabel}
              className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-label-2"
            >
              <X aria-hidden className="size-4.5" />
            </Drawer.Close>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export type AlertProps = Readonly<{
  art?: ReactNode
  cancelLabel: string
  confirmLabel: string
  description: ReactNode
  /** Disables both buttons and keeps the alert open while the action runs. */
  busy?: boolean
  destructive?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  title: ReactNode
}>

/** A centred confirmation. The safe choice comes second and holds the focus. */
export function Alert({
  art,
  busy = false,
  cancelLabel,
  confirmLabel,
  description,
  destructive = false,
  onConfirm,
  onOpenChange,
  open,
  title,
}: AlertProps) {
  return (
    <AlertDialogPrimitive.Root onOpenChange={(next) => !busy && onOpenChange(next)} open={open}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <AlertDialogPrimitive.Content
          className="fixed top-1/2 left-1/2 z-50 flex w-[min(20rem,calc(100vw-2.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2.5 rounded-sheet bg-bg px-5 pt-6 pb-4 text-center"
          onEscapeKeyDown={(event) => busy && event.preventDefault()}
        >
          {art}
          <AlertDialogPrimitive.Title className="text-title-2 font-extrabold">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-subhead font-semibold text-label-2">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-2 flex w-full flex-col gap-2">
            <AlertDialogPrimitive.Action asChild>
              <Button
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault()
                  onConfirm()
                }}
                variant={destructive ? 'destructive' : 'primary'}
                width="full"
              >
                {confirmLabel}
              </Button>
            </AlertDialogPrimitive.Action>
            <AlertDialogPrimitive.Cancel asChild>
              <Button autoFocus disabled={busy} variant="gray" width="full">
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

/** Banners at the top of the screen (new version, saved, errors). Use `toast` from `sonner`. */
export function Toaster(props: ComponentPropsWithRef<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        classNames: {
          description: '!text-label-2 !font-semibold',
          toast:
            '!rounded-card !border-separator !bg-surface !text-label !font-sans !shadow-[0_10px_30px_var(--lt-shadow)]',
          title: '!font-extrabold',
        },
      }}
      {...props}
    />
  )
}

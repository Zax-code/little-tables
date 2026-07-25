// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RemoveMemberDialog } from './family-screen.js'

describe('RemoveMemberDialog', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.open = true
    })
    vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('opens modally, warns clearly, and cancels from the safe default focus', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()

    act(() =>
      root.render(
        <RemoveMemberDialog
          memberName="Léa"
          onCancel={onCancel}
          onConfirm={onConfirm}
          pending={false}
        />,
      ),
    )

    const dialog = container.querySelector('dialog')
    const cancel = container.querySelector<HTMLButtonElement>('.family-remove-dialog__cancel')
    const confirm = container.querySelector<HTMLButtonElement>('.family-remove-dialog__confirm')
    expect(dialog?.open).toBe(true)
    expect(dialog?.getAttribute('role')).toBe('alertdialog')
    expect(dialog?.textContent).toContain('Retirer Léa de la famille ?')
    expect(dialog?.textContent).toContain('Cette action est définitive.')
    expect(document.activeElement).toBe(cancel)

    act(() => cancel?.click())

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(dialog?.open).toBe(false)
    expect(confirm?.textContent).toBe('retirer Léa')
  })

  it('confirms only explicitly and blocks cancellation while removal is pending', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const renderDialog = (pending: boolean) => (
      <RemoveMemberDialog
        memberName="Léa"
        onCancel={onCancel}
        onConfirm={onConfirm}
        pending={pending}
      />
    )
    act(() => root.render(renderDialog(false)))

    const confirm = container.querySelector<HTMLButtonElement>('.family-remove-dialog__confirm')
    act(() => confirm?.click())
    expect(onConfirm).toHaveBeenCalledOnce()

    act(() => root.render(renderDialog(true)))
    const dialog = container.querySelector('dialog')
    const pendingConfirm = container.querySelector<HTMLButtonElement>(
      '.family-remove-dialog__confirm',
    )
    expect(pendingConfirm?.disabled).toBe(true)
    expect(pendingConfirm?.textContent).toBe('retrait en cours…')

    act(() => {
      dialog?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    })
    expect(dialog?.open).toBe(true)
    expect(onCancel).not.toHaveBeenCalled()
  })
})

/**
 * Renders the single pending confirmation request from the confirm store as a
 * modal dialog. Mount <ConfirmDialogHost/> exactly once (main.tsx); call sites
 * use `confirmDialog({...})` from lib/confirm and never touch this directly.
 *
 * Accessibility: role="dialog" + aria-modal, labelled by its title, Escape and
 * backdrop cancel, focus is trapped between the two buttons and restored to the
 * previously focused element on close. For destructive (`danger`) prompts the
 * Cancel button is focused first, so an accidental Enter/second click cancels
 * rather than deletes.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useConfirmStore } from '../lib/confirm'
import type { ConfirmOptions } from '../lib/confirm'

interface DialogProps extends ConfirmOptions {
  onSettle: (confirmed: boolean) => void
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onSettle,
}: DialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = 'confirm-dialog-title'
  const messageId = message ? 'confirm-dialog-message' : undefined

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    // Danger: land on Cancel so a reflexive Enter/click can't confirm.
    ;(tone === 'danger' ? cancelRef : confirmRef).current?.focus()
    return () => previouslyFocused?.focus?.()
  }, [tone])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onSettle(false)
      return
    }
    // Trap Tab between the two buttons.
    if (e.key === 'Tab') {
      e.preventDefault()
      const next = document.activeElement === confirmRef.current ? cancelRef : confirmRef
      next.current?.focus()
    }
  }

  const confirmClasses =
    tone === 'danger'
      ? 'bg-alert text-on-status hover:opacity-90'
      : 'bg-accent-fill text-on-accent hover:opacity-90'

  return (
    <div
      className="confirm-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        // Only a click on the backdrop itself cancels (not one that started
        // inside the panel and dragged out).
        if (e.target === e.currentTarget) onSettle(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={onKeyDown}
        className="confirm-panel w-full max-w-sm rounded-card border border-line bg-face p-5 shadow-overlay"
      >
        <h2 id={titleId} className="font-display text-base font-semibold text-ink">
          {title}
        </h2>
        {message && (
          <p id={messageId} className="mt-2 text-sm leading-relaxed text-muted">
            {message}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onSettle(false)}
            className="label-caps rounded-btn border border-line px-3.5 py-2 font-display text-[11px] text-muted transition-colors duration-150 ease-click hover:border-muted hover:text-ink"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onSettle(true)}
            className={`label-caps rounded-btn px-3.5 py-2 font-display text-[11px] transition-opacity duration-150 ease-click ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmDialogHost() {
  const pending = useConfirmStore((s) => s.pending)
  const settle = useConfirmStore((s) => s.settle)

  if (!pending) return null

  return createPortal(
    <ConfirmDialog key={pending.id} {...pending} onSettle={settle} />,
    document.body,
  )
}

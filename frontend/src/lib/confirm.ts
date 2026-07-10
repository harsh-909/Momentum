/**
 * Promise-based confirmation dialog, styled to match the app instead of the
 * browser's native `window.confirm`. Any code can `await confirmDialog({...})`
 * and get a boolean; a single <ConfirmDialogHost/> (mounted once) renders the
 * pending request. Keeping the queue in its own tiny store lets non-React code
 * (e.g. store actions) trigger a confirm without importing UI.
 */
import { create } from 'zustand'

export interface ConfirmOptions {
  /** Bold headline, e.g. "Delete this goal?". */
  title: string
  /** Optional supporting line explaining the consequence. */
  message?: string
  /** Label for the affirmative button. Defaults to "Confirm". */
  confirmLabel?: string
  /** Label for the dismissive button. Defaults to "Cancel". */
  cancelLabel?: string
  /**
   * `danger` paints the confirm button red and focuses Cancel first, so a
   * reflexive second click or Enter can't fire a destructive action.
   */
  tone?: 'default' | 'danger'
}

interface PendingConfirm extends ConfirmOptions {
  /** Distinct per request so the host can key/remount cleanly. */
  id: number
  resolve: (confirmed: boolean) => void
}

interface ConfirmStore {
  pending: PendingConfirm | null
  request: (options: ConfirmOptions) => Promise<boolean>
  /** Settle the current request and clear it. No-op if nothing is pending. */
  settle: (confirmed: boolean) => void
}

let nextId = 0

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  pending: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      // If something is already open, cancel it so its awaiter never hangs.
      const current = get().pending
      if (current) current.resolve(false)
      nextId += 1
      set({ pending: { ...options, id: nextId, resolve } })
    }),
  settle: (confirmed) => {
    const current = get().pending
    if (!current) return
    current.resolve(confirmed)
    set({ pending: null })
  },
}))

/**
 * Drop-in async replacement for `window.confirm`. Resolves `true` when the user
 * confirms, `false` on cancel / Escape / backdrop. Requires <ConfirmDialogHost/>
 * to be mounted (it is, once, in main.tsx).
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().request(options)
}

import type { SaveStatus } from '../types/domain'

export interface SaveStatusChipProps {
  status: SaveStatus
  /** Immediate re-save; wired to store.flushNow(). */
  onRetry: () => void
}

/**
 * Header save indicator. `idle` renders an empty placeholder of stable width
 * so neighbors never shift; `saved` auto-fades via CSS (.save-chip-fade).
 */
export function SaveStatusChip({ status, onRetry }: SaveStatusChipProps) {
  return (
    <div aria-live="polite" className="min-w-24 text-right text-xs">
      {status === 'saving' && <span className="text-muted">Saving…</span>}
      {status === 'saved' && (
        <span className="save-chip-fade inline-flex items-center gap-1 text-good-text">
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
            <path
              d="M2.5 6.5 5 9 9.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Saved
        </span>
      )}
      {status === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-badge text-alert-text underline-offset-2 transition-colors duration-150 ease-click hover:underline"
        >
          Save failed – retry
        </button>
      )}
    </div>
  )
}

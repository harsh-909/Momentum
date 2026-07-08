/**
 * Day-by-day navigation: prev/next arrows, a native date picker floored at
 * ui.minDate, the formatted display date, and a "Today" shortcut pill that
 * appears only while viewing another day.
 */
import type { ReactNode } from 'react'
import { formatDisplayDate } from '../../lib/engine/dates'
import { useAppStore } from '../../store/useAppStore'

function ArrowButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn border border-line bg-face text-muted transition-colors duration-150 ease-click hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  )
}

export function DateNav() {
  const selectedDate = useAppStore((s) => s.ui.selectedDate)
  const today = useAppStore((s) => s.ui.today)
  const minDate = useAppStore((s) => s.ui.minDate)
  const setSelectedDate = useAppStore((s) => s.setSelectedDate)
  const shiftDate = useAppStore((s) => s.shiftDate)

  return (
    <div className="flex items-center justify-between gap-3">
      <ArrowButton
        label="Previous day"
        disabled={selectedDate <= minDate}
        onClick={() => shiftDate(-1)}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 3 5 8l5 5" />
        </svg>
      </ArrowButton>

      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <div className="truncate font-display text-sm font-semibold text-ink">
          {formatDisplayDate(selectedDate, today)}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Pick a date"
            min={minDate}
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value)
            }}
            className="rounded-btn border border-line bg-face px-2 py-1 text-xs font-mono-num text-ink transition-colors duration-150 ease-click focus:border-accent focus:outline-none"
          />
          {selectedDate !== today && (
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="label-caps rounded-btn border border-accent/40 px-2.5 py-1.5 font-display text-[10px] text-accent-text transition-colors duration-150 ease-click hover:bg-accent-fill hover:text-on-accent"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <ArrowButton label="Next day" onClick={() => shiftDate(1)}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 3 5 5-5 5" />
        </svg>
      </ArrowButton>
    </div>
  )
}

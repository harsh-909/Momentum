/**
 * All / Done / Missed filter pills. The value lives in ui.historyFilter and
 * scopes every expanded day card at once (one filter row, never per-card).
 */
import { useAppStore } from '../../store/useAppStore'
import type { HistoryFilter as HistoryFilterValue } from '../../types/domain'

const FILTERS: Array<{ value: HistoryFilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'complete', label: 'Done' },
  { value: 'incomplete', label: 'Missed' },
]

export function HistoryFilter() {
  const active = useAppStore((s) => s.ui.historyFilter)
  const setHistoryFilter = useAppStore((s) => s.setHistoryFilter)

  return (
    <div role="group" aria-label="Filter days" className="flex gap-1.5">
      {FILTERS.map((f) => {
        const selected = f.value === active
        return (
          <button
            key={f.value}
            type="button"
            aria-pressed={selected}
            onClick={() => setHistoryFilter(f.value)}
            className={`rounded-btn border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ease-click ${
              selected
                ? 'border-ink bg-ink text-face'
                : 'border-line text-muted hover:border-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}

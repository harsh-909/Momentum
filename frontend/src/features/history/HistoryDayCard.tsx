/**
 * One past (or current) day, collapsible. The header always shows the full
 * day's score/summary; the expanded goal rows respect the history filter.
 * Everything here is read-only - history is a frozen record.
 */
import { Card } from '../../components/Card'
import { formatDisplayDate } from '../../lib/engine/dates'
import { dayProgressPct, historyGoalHours } from '../../lib/engine/scoring'
import { fmtDuration } from '../../lib/engine/time'
import type { DateStr, Goal, HistoryFilter } from '../../types/domain'
import { PctBadge } from './PctBadge'

export interface HistoryDayCardProps {
  date: DateStr
  goals: Goal[]
  today: DateStr
  filter: HistoryFilter
  expanded: boolean
  onToggle: (date: DateStr) => void
}

/** Static (non-interactive) done indicator for a history row. */
function DoneMark({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
        done ? 'border-good bg-good' : 'border-line'
      }`}
    >
      {done && (
        <svg viewBox="0 0 22 22" className="h-3 w-3" aria-hidden="true">
          <path
            d="M5.5 11.5 9.5 15.5 16.5 7.5"
            fill="none"
            stroke="var(--color-on-status)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

export function HistoryDayCard({ date, goals, today, filter, expanded, onToggle }: HistoryDayCardProps) {
  const pct = dayProgressPct(goals)
  const done = goals.filter((g) => g.completed).length
  const hours = +goals.reduce((s, g) => s + historyGoalHours(g), 0).toFixed(1)
  const visible =
    filter === 'complete'
      ? goals.filter((g) => g.completed)
      : filter === 'incomplete'
        ? goals.filter((g) => !g.completed)
        : goals

  return (
    <Card padding="none">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onToggle(date)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors duration-150 ease-click hover:bg-dial"
      >
        <span className="flex min-w-0 items-center gap-3">
          <PctBadge pct={pct} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">
              {formatDisplayDate(date, today)}
            </span>
            <span className="block text-xs font-mono-num text-muted">
              {done}/{goals.length} goals &middot; {hours}h
            </span>
          </span>
        </span>
        <svg
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150 ease-click ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m3.5 6 4.5 4.5L12.5 6" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-line px-4 py-3">
          {visible.length === 0 && (
            <p className="text-xs text-muted">
              {filter === 'complete' ? 'Nothing finished this day.' : 'Nothing missed this day.'}
            </p>
          )}
          {visible.map((goal) => (
            <div key={goal.id} className="flex items-start gap-3 py-1">
              <DoneMark done={goal.completed} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm text-ink ${goal.completed ? 'line-through opacity-60' : ''}`}
                  >
                    {goal.topic}
                  </span>
                  <span className="text-xs font-mono-num text-muted">
                    {fmtDuration(historyGoalHours(goal))}
                  </span>
                </div>
                {goal.subtasks.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {goal.subtasks.map((sub) => (
                      <span
                        key={sub.id}
                        className={`rounded-badge border border-line px-1.5 py-0.5 text-xs ${
                          sub.completed ? 'text-good-text line-through' : 'text-muted'
                        }`}
                      >
                        {sub.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

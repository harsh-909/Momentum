/**
 * History tab: every day (up to today) that has goals, newest first.
 * Day cards collapse/expand through ui.expandedHistoryDates; the filter row
 * scopes the goal rows inside every expanded card.
 */
import { EmptyState } from '../../components/EmptyState'
import { useAppStore } from '../../store/useAppStore'
import { HistoryDayCard } from './HistoryDayCard'
import { HistoryFilter } from './HistoryFilter'

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v14.5H7A2.5 2.5 0 0 0 4.5 20z" />
      <path d="M4.5 20A2.5 2.5 0 0 1 7 17.5h12.5" />
      <path d="M8.5 7.5h7" />
    </svg>
  )
}

export function HistoryPage() {
  const goals = useAppStore((s) => s.data.goals)
  const today = useAppStore((s) => s.ui.today)
  const filter = useAppStore((s) => s.ui.historyFilter)
  const expandedDates = useAppStore((s) => s.ui.expandedHistoryDates)
  const toggleHistoryDate = useAppStore((s) => s.toggleHistoryDate)

  // v1 historyDates(): only days that have goals, never future days, newest first.
  const dates = Object.keys(goals)
    .filter((d) => (goals[d] || []).length > 0 && d <= today)
    .sort((a, b) => b.localeCompare(a))

  return (
    <section aria-labelledby="history-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="history-heading" className="font-display text-section font-semibold text-ink">
            Your journey
          </h2>
          <p className="text-sm text-muted">Every day you showed up.</p>
        </div>
        <HistoryFilter />
      </div>

      {dates.length === 0 ? (
        <EmptyState
          icon={<BookIcon />}
          title="Your story starts today"
          hint="Complete some goals and watch your history grow."
        />
      ) : (
        <div className="space-y-3">
          {dates.map((date) => (
            <HistoryDayCard
              key={date}
              date={date}
              goals={goals[date]}
              today={today}
              filter={filter}
              expanded={expandedDates.includes(date)}
              onToggle={toggleHistoryDate}
            />
          ))}
        </div>
      )}
    </section>
  )
}

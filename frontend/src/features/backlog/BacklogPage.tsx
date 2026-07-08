/**
 * Backlog tab: unfinished goals swept off past days, most recent first.
 * Everything here reschedules through the store; habits never appear (the
 * engine refuses to backlog recurringId goals).
 */
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { formatDisplayDate } from '../../lib/engine/dates'
import { useAppStore } from '../../store/useAppStore'
import { BacklogCard } from './BacklogCard'

function CheckCircleIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.4 2.6 2.6 5-5.6" />
    </svg>
  )
}

export function BacklogPage() {
  const backlog = useAppStore((s) => s.data.backlog)
  const carriedThrough = useAppStore((s) => s.data.carriedThrough)
  const today = useAppStore((s) => s.ui.today)

  return (
    <section aria-labelledby="backlog-heading">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 id="backlog-heading" className="font-display text-section font-semibold text-ink">
            Backlog
          </h2>
          <p className="text-sm text-muted">
            Unfinished goals, most recent first. Reschedule when you&apos;re ready.
          </p>
          {carriedThrough && (
            <p className="mt-1 text-xs text-muted">
              Auto-carried through {formatDisplayDate(carriedThrough, today)}
            </p>
          )}
        </div>
        <Badge className="shrink-0">
          <span className="font-mono-num">{backlog.length}</span> waiting
        </Badge>
      </div>

      {backlog.length === 0 ? (
        <EmptyState
          icon={<CheckCircleIcon />}
          title="Nothing's slipping through"
          hint="Your backlog is empty. Keep the momentum going!"
        />
      ) : (
        <div className="space-y-3">
          {backlog.map((item, index) => (
            <BacklogCard key={item.id} item={item} index={index} today={today} />
          ))}
        </div>
      )}
    </section>
  )
}

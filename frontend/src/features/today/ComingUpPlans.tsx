/**
 * "Coming up" hint on Today: the next few plan occurrences due AFTER today
 * (within a two-week horizon). Plans materialize only when their day arrives,
 * so this is a read-only preview. Renders nothing when nothing is upcoming.
 */
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { formatDisplayDate } from '../../lib/engine/dates'
import { upcomingPlans } from '../../lib/engine/plans'
import { fmtDuration } from '../../lib/engine/time'
import { useAppStore } from '../../store/useAppStore'
import { CalendarIcon } from './icons'

const HORIZON_DAYS = 14
const MAX_SHOWN = 5

export function ComingUpPlans() {
  const data = useAppStore((s) => s.data)
  const today = useAppStore((s) => s.ui.today)

  const upcoming = upcomingPlans(data, today, HORIZON_DAYS)
  if (upcoming.length === 0) return null

  return (
    <Card padding="sm">
      <div className="mb-2 flex items-center gap-2 text-muted">
        <CalendarIcon className="h-4 w-4 shrink-0" />
        <span className="font-display text-xs label-caps">Coming up</span>
      </div>
      <ul className="space-y-1.5">
        {upcoming.slice(0, MAX_SHOWN).map(({ date, plan }) => (
          <li key={`${date}-${plan.id}`} className="flex items-center gap-2 text-xs">
            <span className="shrink-0 font-mono-num text-muted">{formatDisplayDate(date, today)}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{plan.topic}</span>
            <Badge>
              <span className="font-mono-num">{fmtDuration(plan.hours)}</span>
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  )
}

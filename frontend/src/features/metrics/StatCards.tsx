/**
 * The four summary tiles above the charts. All values come precomputed from
 * engine computeMetrics; the streak alone earns accent ink once it's alive.
 */
import type { ReactNode } from 'react'
import { Card } from '../../components/Card'
import { fmtDuration } from '../../lib/engine/time'
import type { Metrics } from '../../types/domain'

function FlameIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.8c.4 2.2-2.9 3.6-2.9 6.5a2.9 2.9 0 0 0 5.8 0c0-.8-.3-1.6-.7-2.3-.2 1-.7 1.5-1.3 1.7.5-1.9-.1-4.4-.9-5.9z" />
      <path d="M8 14.2a4.9 4.9 0 0 1-4.9-4.9c0-1.5.6-2.6 1.3-3.7" />
      <path d="M12.9 9.3A4.9 4.9 0 0 1 8 14.2" />
    </svg>
  )
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string
  value: string
  icon?: ReactNode
  accent?: boolean
}) {
  return (
    <Card>
      <div className="font-display text-xs label-caps text-muted">{label}</div>
      <div
        className={`mt-1.5 flex items-center gap-1.5 text-2xl font-semibold font-mono-num ${
          accent ? 'text-accent-text' : 'text-ink'
        }`}
      >
        {icon}
        {value}
      </div>
    </Card>
  )
}

export function StatCards({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Day streak"
        value={String(metrics.streak)}
        icon={<FlameIcon />}
        accent={metrics.streak > 0}
      />
      <StatCard label="7-day completion" value={`${metrics.avgWeek}%`} />
      <StatCard label="Logged (7 days)" value={fmtDuration(metrics.totalHours)} />
      <StatCard label="Goals (7 days)" value={String(metrics.totalGoals)} />
    </div>
  )
}
